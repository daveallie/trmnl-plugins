import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHnClient, parseSearchHits, type FetchLike, type FetchResponse } from "../src/hn/client.ts";
import type { HnSearchResponse, HnItemResponse } from "../src/hn/types.ts";

const search: HnSearchResponse = JSON.parse(
  await readFile(new URL("./fixtures/hn-search.json", import.meta.url), "utf8"),
);
const item: HnItemResponse = JSON.parse(
  await readFile(new URL("./fixtures/hn-item.json", import.meta.url), "utf8"),
);

function fakeFetch(captured: { url: string }, response: FetchResponse): FetchLike {
  return async (url) => {
    captured.url = url;
    return response;
  };
}

test("parseSearchHits normalises hits and drops untitled ones", () => {
  const stories = parseSearchHits({
    hits: [
      { objectID: "1", title: "A", url: "https://x.test", author: "u", points: 10, num_comments: 2, created_at_i: 5 },
      { objectID: "2", points: 99 },
    ],
  });
  assert.equal(stories.length, 1);
  assert.deepEqual(stories[0], {
    id: 1,
    title: "A",
    url: "https://x.test",
    author: "u",
    points: 10,
    num_comments: 2,
    created_at_i: 5,
  });
});

test("getTopStories builds the Algolia search URL for the time window", async () => {
  const captured = { url: "" };
  const client = createHnClient({
    fetchImpl: fakeFetch(captured, { ok: true, json: async () => search }),
  });

  const stories = await client.getTopStories({ since: 1749800000, hitsPerPage: 30 });

  assert.ok(captured.url.startsWith("https://hn.algolia.com/api/v1/search?"));
  assert.match(captured.url, /tags=story/);
  assert.match(captured.url, /numericFilters=created_at_i%3E1749800000/);
  assert.match(captured.url, /hitsPerPage=30/);
  assert.equal(stories.length, 6);
  assert.equal(stories[0]!.title, "Show HN: I built a tiny database in Rust");
});

test("getTopStories throws on a non-ok response", async () => {
  const client = createHnClient({
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });
  await assert.rejects(() => client.getTopStories({ since: 0 }), /HN API returned 503/);
});

test("getTopComments returns stripped top-level comment text up to the limit", async () => {
  const client = createHnClient({
    fetchImpl: async () => ({ ok: true, json: async () => item }),
  });
  const comments = await client.getTopComments(40002, 3);
  assert.equal(comments.length, 3);
  assert.equal(comments[0], "This is the first top comment.");
  assert.equal(comments[1], "Second comment with markup.");
});

test("getTopComments swallows errors and returns an empty array", async () => {
  const client = createHnClient({
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  assert.deepEqual(await client.getTopComments(1, 3), []);
});
