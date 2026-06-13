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

  // Authenticate every route, including the preview (which calls the PTV API).
  app.use(createAuthMiddleware(config.serverSecret));

  const tram = createTramPlugin({ client, now });
  const plugins = [tram];
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

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const app = createApp(config);
  app.listen(config.port, () => {
    console.log(`trmnl-plugins listening on port ${config.port}`);
  });
}
