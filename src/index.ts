import express, { type Express } from "express";
import { readFile } from "node:fs/promises";
import { loadConfig, type Config } from "./config.ts";
import { createAuthMiddleware } from "./auth.ts";
import { createPtvClient, type PtvClient } from "./ptv/client.ts";
import {
  createTramPlugin,
  shapeDepartures,
  ROUTE_TYPE_TRAM,
  STOP_ID,
  MAX_RESULTS,
} from "./plugins/tram.ts";
import { createPreviewHandler } from "./preview.ts";

export interface AppDeps {
  client?: PtvClient;
  now?: () => Date;
}

export function createApp(config: Config, deps: AppDeps = {}): Express {
  const client =
    deps.client ||
    createPtvClient({ userId: config.ptvUserId, apiKey: config.ptvApiKey });
  const now = deps.now || (() => new Date());

  const app = express();
  const auth = createAuthMiddleware(config.serverSecret);

  const plugins = [createTramPlugin({ client, now })];
  for (const plugin of plugins) {
    app.get(`/plugins/${plugin.name}`, auth, plugin.handler);
  }

  const fixtureUrl = new URL("../test/fixtures/ptv-departures.json", import.meta.url);
  const loadTramData = async (useMock: boolean): Promise<object> => {
    const raw = useMock
      ? JSON.parse(await readFile(fixtureUrl, "utf8"))
      : await client.getDepartures({
          routeType: ROUTE_TYPE_TRAM,
          stopId: STOP_ID,
          maxResults: MAX_RESULTS,
        });
    return shapeDepartures(raw, now());
  };
  app.get("/preview/tram", createPreviewHandler({ loadData: loadTramData }));

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const app = createApp(config);
  app.listen(config.port, () => {
    console.log(`trmnl-plugins listening on port ${config.port}`);
  });
}
