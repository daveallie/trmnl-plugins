import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp, type AppDeps } from "../src/index.ts";
import type { PtvClient } from "../src/ptv/client.ts";
import type { PtvDeparturesResponse } from "../src/ptv/types.ts";
import type { Config } from "../src/config.ts";
import { parseSearchHits, type HnClient } from "../src/hn/client.ts";
import { createMemoryCache } from "../src/cache.ts";
import type { Summarizer } from "../src/llm/claude.ts";
import type { HnSearchResponse } from "../src/hn/types.ts";

const fixture: PtvDeparturesResponse = JSON.parse(
  await readFile(new URL("./fixtures/ptv-departures.json", import.meta.url), "utf8"),
);
const NOW = new Date("2026-06-13T03:00:00Z");
const config: Config = { ptvUserId: "1", ptvApiKey: "k", serverSecret: "s3cret", port: 0, redisUrl: "redis://localhost:6379", skipAuth: false };

const hnSearch: HnSearchResponse = JSON.parse(
  await readFile(new URL("./fixtures/hn-search.json", import.meta.url), "utf8"),
);

function hnDeps() {
  const client: HnClient = {
    async getTopStories() {
      return parseSearchHits(hnSearch);
    },
    async getTopComments() {
      return ["a comment"];
    },
  };
  const summarizer: Summarizer = async ({ title }) => `summary of ${title}`;
  return {
    hnClient: client,
    summarizer,
    fetchArticle: async () => "article body",
    cache: createMemoryCache(),
  };
}

function startApp(deps: AppDeps): Promise<{ server: Server; base: string }> {
  const app = createApp(config, deps);
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

test("GET /plugins/tram/:stopId requires a valid Bearer token", async () => {
  const client: PtvClient = { getDepartures: async () => fixture };
  const { server, base } = await startApp({ client, now: () => NOW });
  try {
    const res = await fetch(`${base}/plugins/tram/2070`);
    assert.equal(res.status, 401);

    const ok = await fetch(`${base}/plugins/tram/2070`, {
      headers: { Authorization: "Bearer s3cret" },
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { stop_name: string; departures: { route: string }[] };
    assert.equal(body.stop_name, "Glenferrie Rd/Dandenong Rd");
    assert.equal(body.departures.length, 3);
    assert.equal(body.departures[0]!.route, "3");
  } finally {
    server.close();
  }
});

test("skipAuth allows requests with no Bearer token", async () => {
  const client: PtvClient = { getDepartures: async () => fixture };
  const app = createApp({ ...config, skipAuth: true }, { client, now: () => NOW });
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/plugins/tram/2070`);
    assert.equal(res.status, 200);
  } finally {
    server.close();
  }
});

test("GET /plugins/tram/:stopId returns 400 for an invalid stop id", async () => {
  const client: PtvClient = { getDepartures: async () => fixture };
  const { server, base } = await startApp({ client, now: () => NOW });
  try {
    const res = await fetch(`${base}/plugins/tram/not-a-stop`, {
      headers: { Authorization: "Bearer s3cret" },
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /plugins/tram (no stop id) is 404", async () => {
  const client: PtvClient = { getDepartures: async () => fixture };
  const { server, base } = await startApp({ client, now: () => NOW });
  try {
    const res = await fetch(`${base}/plugins/tram`, {
      headers: { Authorization: "Bearer s3cret" },
    });
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test("GET /plugins/tram/:stopId returns 502 when PTV fails", async () => {
  const client: PtvClient = {
    getDepartures: async () => {
      throw new Error("PTV API returned 503");
    },
  };
  const { server, base } = await startApp({ client, now: () => NOW });
  try {
    const res = await fetch(`${base}/plugins/tram/2070`, {
      headers: { Authorization: "Bearer s3cret" },
    });
    assert.equal(res.status, 502);
  } finally {
    server.close();
  }
});

test("GET /preview/tram/:stopId requires a valid Bearer token", async () => {
  const client: PtvClient = { getDepartures: async () => fixture };
  const { server, base } = await startApp({ client, now: () => NOW });
  try {
    const res = await fetch(`${base}/preview/tram/2070`);
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("GET /preview/tram/:stopId renders HTML from the template", async () => {
  const client: PtvClient = { getDepartures: async () => fixture };
  const { server, base } = await startApp({ client, now: () => NOW });
  try {
    const res = await fetch(`${base}/preview/tram/2070`, {
      headers: { Authorization: "Bearer s3cret" },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    const html = await res.text();
    assert.match(html, /class="screen"/);
    assert.match(html, /class="trmnl"/); // framework CSS is scoped under .trmnl
    assert.match(html, /Tram Times/);
    assert.match(html, /Moonee Ponds/);
    assert.match(html, /Melbourne University/);
    assert.match(html, /trmnl\.com\/css/);
  } finally {
    server.close();
  }
});

test("GET /plugins/hackernews requires a valid Bearer token and returns stories", async () => {
  const client: PtvClient = { getDepartures: async () => fixture };
  const { server, base } = await startApp({ client, now: () => NOW, ...hnDeps() });
  try {
    const unauth = await fetch(`${base}/plugins/hackernews`);
    assert.equal(unauth.status, 401);

    const ok = await fetch(`${base}/plugins/hackernews`, {
      headers: { Authorization: "Bearer s3cret" },
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { stories: { title: string; points: number }[] };
    assert.equal(body.stories.length, 5);
    assert.equal(body.stories[0]!.title, "The hidden cost of microservices");
  } finally {
    server.close();
  }
});

test("GET /preview/hackernews?mock=1 renders HTML from the fixture", async () => {
  const client: PtvClient = { getDepartures: async () => fixture };
  const { server, base } = await startApp({ client, now: () => NOW, ...hnDeps() });
  try {
    const res = await fetch(`${base}/preview/hackernews?mock=1`, {
      headers: { Authorization: "Bearer s3cret" },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    const html = await res.text();
    assert.match(html, /class="trmnl"/);
    assert.match(html, /Hacker News/);
    assert.match(html, /hidden cost of microservices/);
    // metadata line is rendered (points · comments · domain · author)
    assert.match(html, /642 pts/);
  } finally {
    server.close();
  }
});
