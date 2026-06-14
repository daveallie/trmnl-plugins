import type { RequestHandler } from "express";
import type { Plugin } from "../plugin.ts";
import type { PtvClient } from "../ptv/client.ts";
import type { WeatherClient } from "../weather/client.ts";
import type { HnClient } from "../hn/client.ts";
import type { CalendarClient } from "../calendar/client.ts";
import type { Digester } from "../llm/claude.ts";
import type { SummaryCache } from "../cache.ts";
import { fetchTramData, parseStopId } from "./tram.ts";
import { fetchWeatherData, parseLatLon, type LatLon, type WeatherData } from "./weather.ts";
import { parseAgenda, type ShapedEvent } from "../calendar/parse.ts";
import { formatMelbourneTime, formatLongDate } from "../time.ts";

const MAX_TRAMS = 3;
const NEWS_WINDOW_SECONDS = 24 * 60 * 60;
const NEWS_HITS = 30;
const NEWS_TITLES = 8;
const DIGEST_CACHE_KEY = 0;

export interface BriefingWeather {
  temp: number;
  label: string;
  high: number;
  low: number;
  rainChance: number;
  sunrise: string;
  sunset: string;
}

export interface BriefingTram {
  stopName: string;
  departures: { route: string; time: string }[];
}

export interface BriefingData {
  date: string;
  updated_at: string;
  tram: BriefingTram | null;
  weather: BriefingWeather | null;
  agenda: { events: ShapedEvent[] } | null;
  news: { digest: string } | null;
}

export interface BriefingDeps {
  ptvClient: PtvClient;
  weatherClient: WeatherClient;
  hnClient: HnClient;
  calendarClient: CalendarClient;
  digester: Digester;
  digestCache: SummaryCache;
  stop: number;
  coords: LatLon;
  now?: () => Date;
}

export function weatherHighlights(w: WeatherData): BriefingWeather {
  const today = w.daily[0];
  return {
    temp: w.current.temp,
    label: w.current.label,
    high: today?.high ?? 0,
    low: today?.low ?? 0,
    rainChance: today?.chance ?? 0,
    sunrise: w.sunrise,
    sunset: w.sunset,
  };
}

async function loadTram(deps: BriefingDeps, now: Date): Promise<BriefingTram> {
  const data = await fetchTramData(deps.ptvClient, deps.stop, now);
  return {
    stopName: data.stop_name,
    departures: data.departures.slice(0, MAX_TRAMS).map((d) => ({
      route: d.route,
      time: d.time,
    })),
  };
}

async function loadWeather(deps: BriefingDeps, now: Date): Promise<BriefingWeather> {
  return weatherHighlights(await fetchWeatherData(deps.weatherClient, deps.coords, now));
}

async function loadAgenda(deps: BriefingDeps, now: Date): Promise<{ events: ShapedEvent[] }> {
  const texts = await deps.calendarClient.getIcsTexts();
  return { events: parseAgenda(texts, now) };
}

async function loadNews(deps: BriefingDeps, now: Date): Promise<{ digest: string }> {
  const cached = await deps.digestCache.get(DIGEST_CACHE_KEY);
  if (cached !== null) return { digest: cached };
  const since = Math.floor(now.getTime() / 1000) - NEWS_WINDOW_SECONDS;
  const stories = (await deps.hnClient.getTopStories({ since, hitsPerPage: NEWS_HITS }))
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, NEWS_TITLES);
  const digest = await deps.digester(stories.map((s) => s.title));
  if (digest) await deps.digestCache.set(DIGEST_CACHE_KEY, digest);
  return { digest };
}

// Resolve a section promise to its value, or null if it rejects.
async function settle<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export async function fetchBriefingData(deps: BriefingDeps, now: Date): Promise<BriefingData> {
  const [tram, weather, agenda, news] = await Promise.all([
    settle(loadTram(deps, now)),
    settle(loadWeather(deps, now)),
    settle(loadAgenda(deps, now)),
    settle(loadNews(deps, now)),
  ]);
  return {
    date: formatLongDate(now),
    updated_at: formatMelbourneTime(now),
    tram,
    weather,
    agenda,
    news: news && news.digest ? news : null,
  };
}

export function createBriefingPlugin(deps: Omit<BriefingDeps, "stop" | "coords">): Plugin {
  const now = deps.now ?? (() => new Date());
  const handler: RequestHandler = async (req, res) => {
    const stop = parseStopId(typeof req.query.stop === "string" ? req.query.stop : undefined);
    const coords = parseLatLon(typeof req.query.coords === "string" ? req.query.coords : undefined);
    if (stop === null || coords === null) {
      res.status(400).json({ error: "missing or invalid stop/coords query params" });
      return;
    }
    try {
      res.json(await fetchBriefingData({ ...deps, stop, coords }, now()));
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  };
  return { name: "briefing", route: "/briefing", templateUrl: new URL("./briefing.liquid", import.meta.url), handler };
}
