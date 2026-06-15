import type { OpenMeteoResponse } from "../weather/types.ts";
import { weatherCodeToIcon, type IconKey } from "../weather/icons.ts";
import { formatTime, formatDay, formatHour12 } from "../time.ts";
import type { WeatherClient } from "../weather/client.ts";
import type { Plugin } from "../plugin.ts";

export interface LatLon {
  latitude: number;
  longitude: number;
}

// Parses "lat,lon" (e.g. "-37.81,144.96"). Returns null for anything malformed
// or out of range (lat -90..90, lon -180..180).
export function parseLatLon(raw: string | undefined): LatLon | null {
  if (raw === undefined) return null;
  const parts = raw.split(",");
  if (parts.length !== 2) return null;
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (parts[0]?.trim() === "" || parts[1]?.trim() === "") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

// Degrees (0-360, N=0, clockwise) → 8-point compass label.
export function degToCompass(deg: number): string {
  return COMPASS[Math.round(deg / 45) % 8]!;
}

export interface HourlyRain {
  hour: string;
  chance: number;
}

export interface DailyOutlook {
  day: string;
  chance: number;
  high: number;
  low: number;
  rain: number;
  icon: IconKey;
}

export interface WeatherData {
  location: string;
  updated_at: string;
  sunrise: string;
  sunset: string;
  current: {
    temp: number;
    feelsLike: number;
    wind: { speed: number; direction: string };
    icon: IconKey;
    label: string;
  };
  hourly: HourlyRain[];
  daily: DailyOutlook[];
}

const HOURS_AHEAD = 12;

// Interpret a location-local naive ISO string ("2026-06-14T11:00") as a Date
// whose UTC fields equal the local wall clock. Lets us format/compare local
// times deterministically without a real timezone database lookup.
function localToUTCDate(naive: string): Date {
  const withSeconds = naive.length === 16 ? `${naive}:00` : naive;
  return new Date(`${withSeconds}Z`);
}

export function shapeForecast(data: OpenMeteoResponse, now: Date): WeatherData {
  const offsetMs = data.utc_offset_seconds * 1000;
  // `now` shifted so its UTC fields equal the location's local wall clock.
  const nowLocal = new Date(now.getTime() + offsetMs);
  const nowLocalMs = nowLocal.getTime();

  const currentIcon = weatherCodeToIcon(data.current.weather_code);

  // Hourly: first bucket still in the future (end of hour > now), then 12 of them.
  const times = data.hourly.time;
  const probs = data.hourly.precipitation_probability;
  let start = times.findIndex((t) => localToUTCDate(t).getTime() + 3_600_000 > nowLocalMs);
  if (start < 0) start = 0;
  const hourly: HourlyRain[] = [];
  for (let i = start; i < times.length && hourly.length < HOURS_AHEAD; i++) {
    const t = times[i]!;
    hourly.push({
      hour: formatHour12(localToUTCDate(t).getUTCHours()),
      chance: probs[i] ?? 0,
    });
  }

  const daily: DailyOutlook[] = data.daily.time.map((dateStr, i) => {
    const date = localToUTCDate(`${dateStr}T00:00`);
    return {
      day: i === 0 ? "Today" : formatDay(date, "UTC"),
      chance: data.daily.precipitation_probability_max[i] ?? 0,
      high: Math.round(data.daily.temperature_2m_max[i] ?? 0),
      low: Math.round(data.daily.temperature_2m_min[i] ?? 0),
      rain: Math.round((data.daily.precipitation_sum[i] ?? 0) * 10) / 10,
      icon: weatherCodeToIcon(data.daily.weather_code[i] ?? -1).icon,
    };
  });

  return {
    location: `${data.latitude}, ${data.longitude}`,
    updated_at: formatTime(nowLocal, "UTC"),
    sunrise: formatTime(localToUTCDate(data.daily.sunrise[0] ?? ""), "UTC"),
    sunset: formatTime(localToUTCDate(data.daily.sunset[0] ?? ""), "UTC"),
    current: {
      temp: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      wind: {
        speed: Math.round(data.current.wind_speed_10m),
        direction: degToCompass(data.current.wind_direction_10m),
      },
      icon: currentIcon.icon,
      label: currentIcon.label,
    },
    hourly,
    daily,
  };
}

export interface WeatherPluginOptions {
  client: WeatherClient;
  now?: () => Date;
}

// Fetch and shape a forecast. Shared by the plugin route and the preview.
export async function fetchWeatherData(
  client: WeatherClient,
  coords: LatLon,
  now: Date,
): Promise<WeatherData> {
  const data = await client.getForecast(coords);
  return shapeForecast(data, now);
}

export function createWeatherPlugin({ client, now = () => new Date() }: WeatherPluginOptions): Plugin {
  return {
    name: "weather",
    route: "/weather/:coords",
    templateUrl: new URL("./weather.liquid", import.meta.url),
    handler: async (req, res) => {
      const coords = parseLatLon(req.params.coords);
      if (coords === null) {
        res.status(400).json({ error: "invalid coordinates" });
        return;
      }
      try {
        res.json(await fetchWeatherData(client, coords, now()));
      } catch (err) {
        res.status(502).json({ error: (err as Error).message });
      }
    },
  };
}
