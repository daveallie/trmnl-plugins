import type { OpenMeteoResponse } from "./types.ts";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

export interface ForecastQuery {
  latitude: number;
  longitude: number;
}

export interface WeatherClient {
  getForecast(query: ForecastQuery): Promise<OpenMeteoResponse>;
}

export interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

export type FetchLike = (url: string) => Promise<FetchResponse>;

export interface WeatherClientOptions {
  fetchImpl?: FetchLike;
}

const CURRENT_FIELDS =
  "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m";
const HOURLY_FIELDS = "precipitation_probability";
const DAILY_FIELDS =
  "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset";

export function createWeatherClient({ fetchImpl = fetch }: WeatherClientOptions = {}): WeatherClient {
  async function getForecast({ latitude, longitude }: ForecastQuery): Promise<OpenMeteoResponse> {
    const url =
      `${OPEN_METEO_BASE}?latitude=${latitude}&longitude=${longitude}` +
      `&current=${CURRENT_FIELDS}&hourly=${HOURLY_FIELDS}&daily=${DAILY_FIELDS}` +
      `&timezone=auto&forecast_days=7`;
    const res = await fetchImpl(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo API returned ${res.status}`);
    }
    return res.json() as Promise<OpenMeteoResponse>;
  }
  return { getForecast };
}
