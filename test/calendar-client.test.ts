import { test } from "node:test";
import assert from "node:assert/strict";
import { createCalendarClient, type TextFetchLike } from "../src/calendar/client.ts";

test("getIcsTexts returns the bodies of all successful fetches", async () => {
  const fetchImpl: TextFetchLike = async (url) => ({
    ok: true,
    async text() { return `ICS for ${url}`; },
  });
  const client = createCalendarClient({ icsUrls: ["http://a", "http://b"], fetchImpl });
  const texts = await client.getIcsTexts();
  assert.deepEqual(texts.sort(), ["ICS for http://a", "ICS for http://b"]);
});

test("getIcsTexts skips failed and non-ok fetches", async () => {
  const fetchImpl: TextFetchLike = async (url) => {
    if (url === "http://bad") throw new Error("network");
    if (url === "http://404") return { ok: false, status: 404, async text() { return ""; } };
    return { ok: true, async text() { return "good ICS"; } };
  };
  const client = createCalendarClient({ icsUrls: ["http://bad", "http://404", "http://ok"], fetchImpl });
  const texts = await client.getIcsTexts();
  assert.deepEqual(texts, ["good ICS"]);
});

test("getIcsTexts returns [] with no URLs", async () => {
  const client = createCalendarClient({ icsUrls: [] });
  assert.deepEqual(await client.getIcsTexts(), []);
});
