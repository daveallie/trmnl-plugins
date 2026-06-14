import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime, formatDay, formatHour12 } from "../src/time.ts";

test("formatTime formats an instant in a timezone, lowercased", () => {
  assert.equal(formatTime(new Date("2026-06-14T11:18:00Z"), "UTC"), "11:18 am");
  assert.equal(formatTime(new Date("2026-06-14T17:07:00Z"), "UTC"), "5:07 pm");
});

test("formatDay returns a short weekday in a timezone", () => {
  assert.equal(formatDay(new Date("2026-06-14T00:00:00Z"), "UTC"), "Sun");
  assert.equal(formatDay(new Date("2026-06-15T00:00:00Z"), "UTC"), "Mon");
});

test("formatHour12 turns a 0-23 hour into a compact 12h label", () => {
  assert.equal(formatHour12(0), "12AM");
  assert.equal(formatHour12(11), "11AM");
  assert.equal(formatHour12(12), "12PM");
  assert.equal(formatHour12(13), "1PM");
  assert.equal(formatHour12(22), "10PM");
});
