import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatTime, formatDay, formatHour12 } from "../src/time.ts";
import { weatherCodeToIcon } from "../src/weather/icons.ts";
import { createWeatherClient } from "../src/weather/client.ts";
import { parseLatLon, degToCompass, shapeForecast, createWeatherPlugin } from "../src/plugins/weather.ts";
import type { WeatherData } from "../src/plugins/weather.ts";

const FIXTURE = JSON.parse(
  readFileSync(new URL("./fixtures/open-meteo-forecast.json", import.meta.url), "utf8"),
);
// 2026-06-14T01:18Z == 11:18 Melbourne local (UTC+10).
const NOW = new Date("2026-06-14T01:18:00Z");

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
  assert.match(calledUrl, /precipitation_sum/);
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

test("shapeForecast shapes current conditions", () => {
  const out = shapeForecast(FIXTURE, NOW);
  assert.deepEqual(out.current, {
    temp: 12,
    feelsLike: 9,
    wind: { speed: 15, direction: "NW" },
    icon: "clear",
    label: "Clear",
  });
  assert.equal(out.location, "-37.81, 144.96");
  assert.equal(out.updated_at, "11:18 am");
  assert.equal(out.sunrise, "7:33 am");
  assert.equal(out.sunset, "5:07 pm");
});

test("shapeForecast slices up to the next 24 hours of rain chance from now", () => {
  const out = shapeForecast(FIXTURE, NOW);
  // The fixture only carries data through 23:00, so from an 11AM "now" there
  // are 13 hourly buckets available (fewer than the 24-hour cap).
  assert.equal(out.hourly.length, 13);
  assert.deepEqual(out.hourly[0], { hour: "11AM", chance: 30 });
  assert.deepEqual(out.hourly[3], { hour: "2PM", chance: 60 });
  assert.deepEqual(out.hourly[11], { hour: "10PM", chance: 5 });
  assert.deepEqual(out.hourly[12], { hour: "11PM", chance: 10 });
});

test("shapeForecast builds a 7-day outlook with Today + weekdays", () => {
  const out = shapeForecast(FIXTURE, NOW);
  assert.equal(out.daily.length, 7);
  assert.deepEqual(out.daily[0], { day: "Today", chance: 17, high: 13, low: 9, rain: 0, icon: "clear" });
  assert.deepEqual(out.daily[1], { day: "Mon", chance: 61, high: 16, low: 8, rain: 8.2, icon: "rain" });
  assert.deepEqual(out.daily[6], { day: "Sat", chance: 10, high: 18, low: 12, rain: 0, icon: "partly" });
});

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

const fakeClient = (data: unknown) => ({ getForecast: async () => data as never });

test("weather plugin handler returns shaped JSON for valid coords", async () => {
  const plugin = createWeatherPlugin({ client: fakeClient(FIXTURE), now: () => NOW });
  const res = fakeRes();
  await plugin.handler({ params: { coords: "-37.81,144.96" } } as never, res as never, () => {});
  assert.equal(res.statusCode, 200);
  assert.equal((res.body as WeatherData).current.temp, 12);
  assert.equal((res.body as WeatherData).hourly.length, 13);
});

test("weather plugin handler returns 400 for invalid coords", async () => {
  const plugin = createWeatherPlugin({ client: fakeClient(FIXTURE), now: () => NOW });
  const res = fakeRes();
  await plugin.handler({ params: { coords: "nope" } } as never, res as never, () => {});
  assert.equal(res.statusCode, 400);
});

test("weather plugin handler returns 502 on upstream failure", async () => {
  const client = { getForecast: async () => { throw new Error("boom"); } };
  const plugin = createWeatherPlugin({ client, now: () => NOW });
  const res = fakeRes();
  await plugin.handler({ params: { coords: "0,0" } } as never, res as never, () => {});
  assert.equal(res.statusCode, 502);
});
