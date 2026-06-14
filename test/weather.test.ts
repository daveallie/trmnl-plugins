import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime, formatDay, formatHour12 } from "../src/time.ts";
import { weatherCodeToIcon } from "../src/weather/icons.ts";

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

test("weatherCodeToIcon maps WMO codes to a category icon + label", () => {
  assert.deepEqual(weatherCodeToIcon(0), { icon: "clear", label: "Clear" });
  assert.deepEqual(weatherCodeToIcon(2), { icon: "partly", label: "Partly cloudy" });
  assert.deepEqual(weatherCodeToIcon(3), { icon: "cloudy", label: "Cloudy" });
  assert.deepEqual(weatherCodeToIcon(45), { icon: "fog", label: "Fog" });
  assert.deepEqual(weatherCodeToIcon(51), { icon: "drizzle", label: "Drizzle" });
  assert.deepEqual(weatherCodeToIcon(61), { icon: "rain", label: "Rain" });
  assert.deepEqual(weatherCodeToIcon(80), { icon: "rain", label: "Rain" });
  assert.deepEqual(weatherCodeToIcon(71), { icon: "snow", label: "Snow" });
  assert.deepEqual(weatherCodeToIcon(95), { icon: "thunder", label: "Thunderstorm" });
});

test("weatherCodeToIcon falls back to cloudy/Unknown for unknown codes", () => {
  assert.deepEqual(weatherCodeToIcon(999), { icon: "cloudy", label: "Unknown" });
});
