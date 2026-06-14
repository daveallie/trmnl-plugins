import { test } from "node:test";
import assert from "node:assert/strict";
import { melbourneDayBounds, melbourneHour, formatLongDate } from "../src/time.ts";

// 2026-06-14 is winter in Melbourne → AEST (UTC+10). 01:18Z == 11:18 local.
const NOW = new Date("2026-06-14T01:18:00Z");

test("melbourneDayBounds returns local midnight-to-midnight as UTC instants", () => {
  const { start, end } = melbourneDayBounds(NOW);
  // Local Sun 14 Jun 00:00 AEST == 2026-06-13T14:00:00Z; end is +24h.
  assert.equal(start.toISOString(), "2026-06-13T14:00:00.000Z");
  assert.equal(end.toISOString(), "2026-06-14T14:00:00.000Z");
});

test("melbourneHour returns the local hour-of-day (0-23)", () => {
  assert.equal(melbourneHour(NOW), 11);
});

test("formatLongDate formats the Melbourne date", () => {
  assert.equal(formatLongDate(NOW), "Sunday 14 June");
});
