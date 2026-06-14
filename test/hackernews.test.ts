import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Request, Response, NextFunction } from "express";
import {
  domainFromUrl,
  fetchHackerNewsData,
  createHackerNewsPlugin,
  type HackerNewsData,
} from "../src/plugins/hackernews.ts";
import { parseSearchHits, type HnClient } from "../src/hn/client.ts";
import { createMemoryCache } from "../src/cache.ts";
import type { Summarizer } from "../src/llm/claude.ts";
import type { HnSearchResponse } from "../src/hn/types.ts";

const search: HnSearchResponse = JSON.parse(
  await readFile(new URL("./fixtures/hn-search.json", import.meta.url), "utf8"),
);
const NOW = new Date("2026-06-14T00:00:00Z");
const noop: NextFunction = () => {};

function fixtureClient(): HnClient {
  return {
    async getTopStories() {
      return parseSearchHits(search);
    },
    async getTopComments() {
      return ["a top comment"];
    },
  };
}

function countingSummarizer() {
  const calls: number[] = [];
  const summarizer: Summarizer = async ({ title }) => {
    calls.push(1);
    return `summary of ${title}`;
  };
  return { summarizer, calls };
}

const deps = (over: Partial<Parameters<typeof createHackerNewsPlugin>[0]> = {}) => ({
  client: fixtureClient(),
  summarizer: countingSummarizer().summarizer,
  fetchArticle: async () => "article body",
  cache: createMemoryCache(),
  now: () => NOW,
  ...over,
});

function mockRes() {
  const recorded: { statusCode: number; body: unknown } = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      recorded.statusCode = code;
      return res;
    },
    json(body: unknown) {
      recorded.body = body;
      return res;
    },
  };
  return { res: res as unknown as Response, recorded };
}

test("domainFromUrl strips www and falls back for self posts", () => {
  assert.equal(domainFromUrl("https://www.github.com/a/b"), "github.com");
  assert.equal(domainFromUrl("https://blog.example.com/x"), "blog.example.com");
  assert.equal(domainFromUrl(undefined), "news.ycombinator.com");
  assert.equal(domainFromUrl("not a url"), "news.ycombinator.com");
});

test("fetchHackerNewsData sorts by points, keeps the top 5, and shapes each story", async () => {
  const data = await fetchHackerNewsData(deps(), NOW);
  assert.equal(data.stories.length, 5);
  // Sorted by points desc: 642, 578, 512, 489, 305 — the 12-point filler is dropped.
  assert.deepEqual(data.stories.map((s) => s.points), [642, 578, 512, 489, 305]);
  const top = data.stories[0]!;
  assert.equal(top.title, "The hidden cost of microservices");
  assert.equal(top.domain, "blog.example.com");
  assert.equal(top.comments, 201);
  assert.equal(top.author, "architect");
  assert.equal(top.summary, "summary of The hidden cost of microservices");
  // Ask HN post (no url) falls back to the HN domain.
  const askHn = data.stories.find((s) => s.title.startsWith("Ask HN"))!;
  assert.equal(askHn.domain, "news.ycombinator.com");
  assert.match(data.updated_at, /am|pm/);
});

test("summaries are cached by story id across polls", async () => {
  const { summarizer, calls } = countingSummarizer();
  const cache = createMemoryCache();
  const client = fixtureClient();
  const d = { client, summarizer, fetchArticle: async () => "x", cache, now: () => NOW };
  await fetchHackerNewsData(d, NOW);
  await fetchHackerNewsData(d, NOW);
  // 5 stories summarized once each; the second poll hits the cache.
  assert.equal(calls.length, 5);
});

test("a failing summarizer degrades to an empty summary without crashing", async () => {
  const summarizer: Summarizer = async () => {
    throw new Error("LLM exploded");
  };
  const data = await fetchHackerNewsData(deps({ summarizer }), NOW);
  assert.equal(data.stories.length, 5);
  assert.equal(data.stories[0]!.summary, "");
});

test("handler returns shaped JSON", async () => {
  const plugin = createHackerNewsPlugin(deps());
  assert.equal(plugin.name, "hackernews");
  assert.equal(plugin.route, "/hackernews");
  const { res, recorded } = mockRes();
  await plugin.handler({} as Request, res, noop);
  const body = recorded.body as HackerNewsData;
  assert.equal(body.stories.length, 5);
  assert.equal(body.stories[0]!.title, "The hidden cost of microservices");
});

test("handler returns 502 when the HN API fails", async () => {
  const client: HnClient = {
    async getTopStories() {
      throw new Error("HN API returned 503");
    },
    async getTopComments() {
      return [];
    },
  };
  const plugin = createHackerNewsPlugin(deps({ client }));
  const { res, recorded } = mockRes();
  await plugin.handler({} as Request, res, noop);
  assert.equal(recorded.statusCode, 502);
  assert.match((recorded.body as { error: string }).error, /503/);
});
