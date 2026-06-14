import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Request, Response, NextFunction } from "express";
import {
  weatherHighlights,
  fetchBriefingData,
  createBriefingPlugin,
  type BriefingDeps,
  type BriefingData,
} from "../src/plugins/briefing.ts";
import { shapeForecast } from "../src/plugins/weather.ts";
import type { OpenMeteoResponse } from "../src/weather/types.ts";
import type { PtvDeparturesResponse } from "../src/ptv/types.ts";

const NOW = new Date("2026-06-14T01:18:00Z");
const noop: NextFunction = () => {};

const forecast: OpenMeteoResponse = JSON.parse(
  await readFile(new URL("./fixtures/open-meteo-forecast.json", import.meta.url), "utf8"),
);
const departures: PtvDeparturesResponse = JSON.parse(
  await readFile(new URL("./fixtures/ptv-departures.json", import.meta.url), "utf8"),
);
const TRAM_NOW = new Date("2026-06-13T03:00:00Z"); // matches the tram fixture window

function makeDeps(over: Partial<BriefingDeps> = {}): BriefingDeps {
  return {
    ptvClient: { async getDepartures() { return departures; } },
    weatherClient: { async getForecast() { return forecast; } },
    hnClient: {
      async getTopStories() {
        return [{ id: 1, title: "AI ships agents", author: "a", points: 10, num_comments: 1, created_at_i: 0 }];
      },
      async getTopComments() { return []; },
    },
    calendarClient: { async getIcsTexts() { return []; } },
    digester: async () => "Tech is busy today. Agents everywhere.",
    digestCache: (() => {
      const m = new Map<number, string>();
      return { async get(k) { return m.has(k) ? m.get(k)! : null; }, async set(k, v) { m.set(k, v); } };
    })(),
    stop: 1234,
    coords: { latitude: -37.81, longitude: 144.96 },
    now: () => NOW,
    ...over,
  };
}

test("weatherHighlights projects the fields the briefing needs", () => {
  const wx = weatherHighlights(shapeForecast(forecast, NOW));
  assert.equal(typeof wx.temp, "number");
  assert.equal(typeof wx.high, "number");
  assert.equal(typeof wx.low, "number");
  assert.equal(typeof wx.rainChance, "number");
  assert.equal(typeof wx.label, "string");
  assert.match(wx.sunrise, /am|pm/);
  assert.match(wx.sunset, /am|pm/);
});

test("fetchBriefingData populates every section on the happy path", async () => {
  const data = await fetchBriefingData(makeDeps({ now: () => TRAM_NOW }), TRAM_NOW);
  assert.match(data.date, /June/);
  assert.ok(data.tram && data.tram.departures.length > 0 && data.tram.departures.length <= 3);
  assert.ok(data.tram!.departures[0]!.time.match(/am|pm/));
  assert.ok(data.weather && typeof data.weather.temp === "number");
  assert.ok(data.agenda && Array.isArray(data.agenda.events));
  assert.ok(data.news && data.news.digest.length > 0);
});

test("a failed section degrades to null while others survive", async () => {
  const deps = makeDeps({
    weatherClient: { async getForecast() { throw new Error("open-meteo down"); } },
    now: () => TRAM_NOW,
  });
  const data = await fetchBriefingData(deps, TRAM_NOW);
  assert.equal(data.weather, null);
  assert.ok(data.tram);
});

test("agenda is null when the calendar client throws, [] when it returns no URLs", async () => {
  const thrown = await fetchBriefingData(
    makeDeps({ calendarClient: { async getIcsTexts() { throw new Error("boom"); } }, now: () => TRAM_NOW }),
    TRAM_NOW,
  );
  assert.equal(thrown.agenda, null);
  const empty = await fetchBriefingData(makeDeps({ now: () => TRAM_NOW }), TRAM_NOW);
  assert.deepEqual(empty.agenda, { events: [] });
});

test("news digest is cached across polls", async () => {
  let calls = 0;
  const deps = makeDeps({ digester: async () => { calls++; return "cached digest text."; }, now: () => TRAM_NOW });
  await fetchBriefingData(deps, TRAM_NOW);
  await fetchBriefingData(deps, TRAM_NOW);
  assert.equal(calls, 1);
});

test("handler returns 400 for missing stop/coords and 200 with body otherwise", async () => {
  const plugin = createBriefingPlugin(makeDeps({ now: () => TRAM_NOW }));
  assert.equal(plugin.name, "briefing");
  assert.equal(plugin.route, "/briefing");

  const rec1 = mockRes();
  await plugin.handler({ query: {} } as unknown as Request, rec1.res, noop);
  assert.equal(rec1.recorded.statusCode, 400);

  const rec2 = mockRes();
  await plugin.handler(
    { query: { stop: "1234", coords: "-37.81,144.96" } } as unknown as Request,
    rec2.res,
    noop,
  );
  assert.equal(rec2.recorded.statusCode, 200);
  assert.ok((rec2.recorded.body as BriefingData).date);
});

function mockRes() {
  const recorded: { statusCode: number; body: unknown } = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) { recorded.statusCode = code; return res; },
    json(body: unknown) { recorded.body = body; return res; },
  };
  return { res: res as unknown as Response, recorded };
}
