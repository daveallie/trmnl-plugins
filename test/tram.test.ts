import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Request, Response, NextFunction } from "express";
import { shapeDepartures, createTramPlugin, parseStopId, type TramData } from "../src/plugins/tram.ts";
import type { PtvClient } from "../src/ptv/client.ts";
import type { PtvDeparturesResponse } from "../src/ptv/types.ts";

const fixture: PtvDeparturesResponse = JSON.parse(
  await readFile(new URL("./fixtures/ptv-departures.json", import.meta.url), "utf8"),
);
const NOW = new Date("2026-06-13T03:00:00Z"); // 1:00 pm Melbourne (UTC+10, AEST — June has no DST)

const noop: NextFunction = () => {};

function reqWithStop(stopId: string): Request {
  return { params: { stopId } } as unknown as Request;
}

// Minimal Express Response stub that records the status code and JSON body.
function mockRes() {
  const recorded: { statusCode: number; body: unknown } = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      recorded.statusCode = code;
      return res;
    },
    json(body: unknown) {
      recorded.body = body;
      return res;
    },
  };
  return { res: res as unknown as Response, recorded };
}

test("shapeDepartures sorts, computes minutes, picks realtime, formats Melbourne time", () => {
  const result = shapeDepartures(fixture, NOW);
  assert.deepEqual(result, {
    stop_name: "Glenferrie Rd/Dandenong Rd",
    updated_at: "1:00 pm",
    departures: [
      { route: "3", destination: "Moonee Ponds", minutes: 2, time: "1:02 pm", realtime: true },
      { route: "3", destination: "Moonee Ponds", minutes: 4, time: "1:04 pm", realtime: true },
      { route: "16", destination: "Melbourne University", minutes: 11, time: "1:11 pm", realtime: false },
    ],
  });
});

test("shapeDepartures trims to the limit", () => {
  const result = shapeDepartures(fixture, NOW, { limit: 2 });
  assert.equal(result.departures.length, 2);
  assert.equal(result.departures[0]!.minutes, 2);
});

test("shapeDepartures handles empty/missing data", () => {
  const result = shapeDepartures({}, NOW);
  assert.deepEqual(result.departures, []);
  assert.equal(result.stop_name, "");
  assert.equal(result.updated_at, "1:00 pm");
});

test("parseStopId accepts positive integers and rejects anything else", () => {
  assert.equal(parseStopId("2070"), 2070);
  assert.equal(parseStopId("abc"), null);
  assert.equal(parseStopId("12.5"), null);
  assert.equal(parseStopId(""), null);
  assert.equal(parseStopId(undefined), null);
});

test("tram plugin handler returns shaped JSON for the requested stop", async () => {
  const client: PtvClient = { getDepartures: async () => fixture };
  const plugin = createTramPlugin({ client, now: () => NOW });
  assert.equal(plugin.name, "tram");
  assert.equal(plugin.route, "/tram/:stopId");

  const { res, recorded } = mockRes();
  await plugin.handler(reqWithStop("2070"), res, noop);
  const body = recorded.body as TramData;
  assert.equal(body.departures[0]!.route, "3");
  assert.equal(body.departures.length, 3);
});

test("tram plugin handler passes the stop id through to the client", async () => {
  let received: number | undefined;
  const client: PtvClient = {
    getDepartures: async ({ stopId }) => {
      received = stopId;
      return fixture;
    },
  };
  const plugin = createTramPlugin({ client, now: () => NOW });

  const { res } = mockRes();
  await plugin.handler(reqWithStop("1234"), res, noop);
  assert.equal(received, 1234);
});

test("tram plugin handler returns 400 for an invalid stop id", async () => {
  const client: PtvClient = { getDepartures: async () => fixture };
  const plugin = createTramPlugin({ client, now: () => NOW });

  const { res, recorded } = mockRes();
  await plugin.handler(reqWithStop("not-a-stop"), res, noop);
  assert.equal(recorded.statusCode, 400);
  assert.deepEqual(recorded.body, { error: "invalid stop id" });
});

test("tram plugin handler returns 502 on upstream failure", async () => {
  const client: PtvClient = {
    getDepartures: async () => {
      throw new Error("PTV API returned 503");
    },
  };
  const plugin = createTramPlugin({ client, now: () => NOW });

  const { res, recorded } = mockRes();
  await plugin.handler(reqWithStop("2070"), res, noop);
  assert.equal(recorded.statusCode, 502);
  assert.match((recorded.body as { error: string }).error, /503/);
});

test("shapeDepartures clamps already-departed trams to 0 minutes", () => {
  const data: PtvDeparturesResponse = {
    departures: [
      { route_id: 1, direction_id: 10, run_ref: "x", scheduled_departure_utc: "2026-06-13T02:58:00Z", estimated_departure_utc: null },
    ],
    routes: { "1": { route_number: "3" } },
    directions: { "10": { direction_name: "Moonee Ponds" } },
  };
  const result = shapeDepartures(data, NOW);
  assert.equal(result.departures.length, 1);
  assert.equal(result.departures[0]!.minutes, 0);
  assert.equal(result.departures[0]!.realtime, false);
});

test("shapeDepartures drops departures with no usable timestamp", () => {
  const data: PtvDeparturesResponse = {
    departures: [
      { route_id: 1, direction_id: 10, run_ref: "x", scheduled_departure_utc: null, estimated_departure_utc: null },
      { route_id: 1, direction_id: 10, run_ref: "y", scheduled_departure_utc: "2026-06-13T03:06:00Z", estimated_departure_utc: null },
    ],
    routes: { "1": { route_number: "3" } },
    directions: { "10": { direction_name: "Moonee Ponds" } },
  };
  const result = shapeDepartures(data, NOW);
  assert.equal(result.departures.length, 1);
  assert.equal(result.departures[0]!.minutes, 6);
});
