import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime, formatDay, formatHour12 } from "../src/time.ts";
import { weatherCodeToIcon } from "../src/weather/icons.ts";
import { createWeatherClient } from "../src/weather/client.ts";
import { parseLatLon, degToCompass } from "../src/plugins/weather.ts";

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

test("getForecast builds the Open-Meteo URL with coords, fields, timezone and days", async () => {
  let calledUrl = "";
  const client = createWeatherClient({
    fetchImpl: async (url: string) => {
      calledUrl = url;
      return { ok: true, json: async () => ({ ok: 1 }) };
    },
  });

  const data = await client.getForecast({ latitude: -37.81, longitude: 144.96 });

  assert.deepEqual(data, { ok: 1 });
  assert.ok(calledUrl.startsWith("https://api.open-meteo.com/v1/forecast?"));
  assert.match(calledUrl, /latitude=-37\.81/);
  assert.match(calledUrl, /longitude=144\.96/);
  assert.match(calledUrl, /timezone=auto/);
  assert.match(calledUrl, /forecast_days=7/);
  assert.match(calledUrl, /current=temperature_2m/);
  assert.match(calledUrl, /hourly=precipitation_probability/);
  assert.match(calledUrl, /daily=weather_code/);
});

test("getForecast throws on a non-ok response", async () => {
  const client = createWeatherClient({
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });
  await assert.rejects(
    () => client.getForecast({ latitude: 0, longitude: 0 }),
    /Open-Meteo API returned 503/,
  );
});

test("parseLatLon accepts a valid lat,lon pair", () => {
  assert.deepEqual(parseLatLon("-37.81,144.96"), { latitude: -37.81, longitude: 144.96 });
  assert.deepEqual(parseLatLon("0,0"), { latitude: 0, longitude: 0 });
});

test("parseLatLon rejects malformed, missing, out-of-range, or extra parts", () => {
  assert.equal(parseLatLon(undefined), null);
  assert.equal(parseLatLon(""), null);
  assert.equal(parseLatLon("melbourne"), null);
  assert.equal(parseLatLon("-37.81"), null);
  assert.equal(parseLatLon("-37.81,144.96,5"), null);
  assert.equal(parseLatLon("91,0"), null);
  assert.equal(parseLatLon("0,181"), null);
  assert.equal(parseLatLon("abc,def"), null);
});

test("degToCompass maps degrees to an 8-point label", () => {
  assert.equal(degToCompass(0), "N");
  assert.equal(degToCompass(315), "NW");
  assert.equal(degToCompass(360), "N");
  assert.equal(degToCompass(90), "E");
});
