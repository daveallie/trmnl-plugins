import express, { type Express } from "express";
import { readFile } from "node:fs/promises";
import { loadConfig, type Config } from "./config.ts";
import { createAuthMiddleware } from "./auth.ts";
import { createPtvClient, type PtvClient } from "./ptv/client.ts";
import {
  createTramPlugin,
  shapeDepartures,
  fetchTramData,
  parseStopId,
} from "./plugins/tram.ts";
import { createHnClient, parseSearchHits, type HnClient } from "./hn/client.ts";
import { fetchArticleText } from "./hn/article.ts";
import {
  createClaudeSummarizer,
  noopSummarizer,
  type Summarizer,
  createClaudeDigester,
  noopDigester,
  type Digester,
} from "./llm/claude.ts";
import { createRedisCache, createMemoryCache, type SummaryCache } from "./cache.ts";
import {
  createHackerNewsPlugin,
  fetchHackerNewsData,
  type ArticleFetcher,
} from "./plugins/hackernews.ts";
import { createWeatherClient, type WeatherClient } from "./weather/client.ts";
import {
  createWeatherPlugin,
  shapeForecast,
  fetchWeatherData,
  parseLatLon,
} from "./plugins/weather.ts";
import { createCalendarClient, type CalendarClient } from "./calendar/client.ts";
import {
  createBriefingPlugin,
  fetchBriefingData,
  type BriefingDeps,
} from "./plugins/briefing.ts";
import { createPreviewHandler } from "./preview.ts";

export interface AppDeps {
  client?: PtvClient;
  hnClient?: HnClient;
  summarizer?: Summarizer;
  fetchArticle?: ArticleFetcher;
  cache?: SummaryCache;
  weatherClient?: WeatherClient;
  digester?: Digester;
  calendarClient?: CalendarClient;
  digestCache?: SummaryCache;
  now?: () => Date;
}

export function createApp(config: Config, deps: AppDeps = {}): Express {
  const client =
    deps.client ||
    createPtvClient({ userId: config.ptvUserId, apiKey: config.ptvApiKey });
  const hnClient = deps.hnClient || createHnClient();
  const summarizer =
    deps.summarizer ||
    (config.anthropicApiKey
      ? createClaudeSummarizer({ apiKey: config.anthropicApiKey })
      : noopSummarizer);
  const fetchArticle: ArticleFetcher = deps.fetchArticle || fetchArticleText;
  const cache = deps.cache || createRedisCache({ url: config.redisUrl });
  const digester =
    deps.digester ||
    (config.anthropicApiKey ? createClaudeDigester({ apiKey: config.anthropicApiKey }) : noopDigester);
  const calendarClient =
    deps.calendarClient || createCalendarClient({ icsUrls: config.briefingIcsUrls });
  const digestCache =
    deps.digestCache ||
    createRedisCache({ url: config.redisUrl, keyPrefix: "briefing:digest:", ttlSeconds: 60 * 60 });
  const now = deps.now || (() => new Date());

  const app = express();

  // Authenticate every route, including the preview (which calls upstream APIs).
  // SKIP_AUTH bypasses this for local previews — never set it in production.
  if (config.skipAuth) {
    console.warn("⚠️  SKIP_AUTH is set — auth is disabled and all routes are public");
  } else {
    app.use(createAuthMiddleware(config.serverSecret));
  }

  const weatherClient = deps.weatherClient || createWeatherClient();

  const tram = createTramPlugin({ client, now });
  const hackernews = createHackerNewsPlugin({ client: hnClient, summarizer, fetchArticle, cache, now });
  const weather = createWeatherPlugin({ client: weatherClient, now });
  const briefing = createBriefingPlugin({
    ptvClient: client,
    weatherClient,
    hnClient,
    calendarClient,
    digester,
    digestCache,
    now,
  });
  const plugins = [tram, hackernews, weather, briefing];
  for (const plugin of plugins) {
    app.get(`/plugins${plugin.route}`, plugin.handler);
  }

  const fixtureUrl = new URL("../test/fixtures/ptv-departures.json", import.meta.url);
  app.get(
    "/preview/tram/:stopId",
    createPreviewHandler({
      templateUrl: tram.templateUrl,
      loadData: async (req): Promise<object> => {
        if (req.query.mock) {
          // Anchor "now" to the bundled fixture's reference time so the mock
          // preview shows representative minutes rather than all-overdue.
          const mockNow = new Date("2026-06-13T03:00:00Z");
          return shapeDepartures(JSON.parse(await readFile(fixtureUrl, "utf8")), mockNow);
        }
        const stopId = parseStopId(req.params.stopId);
        if (stopId === null) {
          throw new Error("invalid stop id");
        }
        return fetchTramData(client, stopId, now());
      },
    }),
  );

  const hnFixtureUrl = new URL("../test/fixtures/hn-search.json", import.meta.url);
  app.get(
    "/preview/hackernews",
    createPreviewHandler({
      templateUrl: hackernews.templateUrl,
      loadData: async (req): Promise<object> => {
        if (req.query.mock) {
          const mockNow = new Date("2026-06-14T00:00:00Z");
          const fixture = parseSearchHits(JSON.parse(await readFile(hnFixtureUrl, "utf8")));
          const mockClient: HnClient = {
            async getTopStories() {
              return fixture;
            },
            async getTopComments() {
              return [];
            },
          };
          return fetchHackerNewsData(
            {
              client: mockClient,
              summarizer: async ({ title }) => `A concise summary of "${title}".`,
              fetchArticle: async () => "",
              cache: createMemoryCache(),
              now: () => mockNow,
            },
            mockNow,
          );
        }
        return fetchHackerNewsData({ client: hnClient, summarizer, fetchArticle, cache, now }, now());
      },
    }),
  );

  const weatherFixtureUrl = new URL(
    "../test/fixtures/open-meteo-forecast.json",
    import.meta.url,
  );
  app.get(
    "/preview/weather/:coords",
    createPreviewHandler({
      templateUrl: weather.templateUrl,
      loadData: async (req): Promise<object> => {
        if (req.query.mock) {
          // Anchor "now" to the fixture's reference time (11:18 Melbourne local).
          const mockNow = new Date("2026-06-14T01:18:00Z");
          return shapeForecast(JSON.parse(await readFile(weatherFixtureUrl, "utf8")), mockNow);
        }
        const coords = parseLatLon(req.params.coords);
        if (coords === null) {
          throw new Error("invalid coordinates");
        }
        return fetchWeatherData(weatherClient, coords, now());
      },
    }),
  );

  app.get(
    "/preview/briefing",
    createPreviewHandler({
      templateUrl: briefing.templateUrl,
      loadData: async (req): Promise<object> => {
        if (req.query.mock) {
          const mockNow = new Date("2026-06-13T03:00:00Z"); // matches the tram fixture window
          const tramFixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
          const wxFixture = JSON.parse(await readFile(weatherFixtureUrl, "utf8"));
          const calFixture = await readFile(
            new URL("../test/fixtures/briefing-calendar.ics", import.meta.url),
            "utf8",
          );
          const mockDeps: BriefingDeps = {
            ptvClient: { async getDepartures() { return tramFixture; } },
            weatherClient: { async getForecast() { return wxFixture; } },
            hnClient: {
              async getTopStories() {
                return [
                  { id: 1, title: "AI labs race to ship autonomous agents", author: "a", points: 9, num_comments: 1, created_at_i: 0 },
                  { id: 2, title: "New chip startup claims 3x efficiency", author: "b", points: 8, num_comments: 1, created_at_i: 0 },
                ];
              },
              async getTopComments() { return []; },
            },
            calendarClient: createCalendarClient({
              icsUrls: ["mock"],
              fetchImpl: async () => ({ ok: true, async text() { return calFixture; } }),
            }),
            digester: async () =>
              "AI labs race to ship autonomous agents as a new chip startup claims a 3x efficiency win. Debate continues over open-weights safety.",
            digestCache: createMemoryCache(),
            stop: 1,
            coords: { latitude: -37.81, longitude: 144.96 },
            now: () => mockNow,
          };
          return fetchBriefingData(mockDeps, mockNow);
        }
        const stop = parseStopId(typeof req.query.stop === "string" ? req.query.stop : undefined);
        const coords = parseLatLon(typeof req.query.coords === "string" ? req.query.coords : undefined);
        if (stop === null || coords === null) throw new Error("missing or invalid stop/coords");
        return fetchBriefingData(
          { ptvClient: client, weatherClient, hnClient, calendarClient, digester, digestCache, stop, coords, now },
          now(),
        );
      },
    }),
  );

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const app = createApp(config);
  app.listen(config.port, () => {
    console.log(`trmnl-plugins listening on port ${config.port}`);
  });
}
