import { test } from "node:test";
import assert from "node:assert/strict";
import { createPtvClient, type FetchLike, type FetchResponse } from "../src/ptv/client.ts";

function fakeFetch(captured: { url: string }, response: FetchResponse): FetchLike {
  return async (url) => {
    captured.url = url;
    return response;
  };
}

test("getDepartures builds a signed URL with devid, expands and signature", async () => {
  const captured = { url: "" };
  const client = createPtvClient({
    userId: "1000000",
    apiKey: "testkey",
    fetchImpl: fakeFetch(captured, { ok: true, json: async () => ({ departures: [] }) }),
  });

  const data = await client.getDepartures({ routeType: 1, stopId: 2070, maxResults: 5 });

  assert.ok(captured.url.startsWith("https://timetableapi.ptv.vic.gov.au/v3/departures/route_type/1/stop/2070?"));
  assert.match(captured.url, /devid=1000000/);
  assert.match(captured.url, /max_results=5/);
  assert.match(captured.url, /expand=Route/);
  assert.match(captured.url, /expand=Direction/);
  assert.match(captured.url, /expand=Run/);
  assert.match(captured.url, /expand=Stop/);
  assert.match(captured.url, /signature=98AC86DD23F417DB1DC3705621B98C81A8BFB8D5$/);
  assert.deepEqual(data, { departures: [] });
});

test("getDepartures throws on non-ok response", async () => {
  const client = createPtvClient({
    userId: "1000000",
    apiKey: "testkey",
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });
  await assert.rejects(
    () => client.getDepartures({ routeType: 1, stopId: 2070 }),
    /PTV API returned 503/,
  );
});
