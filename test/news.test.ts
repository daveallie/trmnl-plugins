import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRssTitles, createNewsClient, type TextFetchLike } from "../src/news/client.ts";

const FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Channel Title — ignore me</title>
  <image><title>Image Title — ignore me</title></image>
  <item><title>Plain headline &amp; more</title><link>https://x/1</link></item>
  <item><title><![CDATA[CDATA headline with <b>tags</b>]]></title></item>
  <item><description>no title here</description></item>
  <item><title>  Trimmed &#39;quoted&#39; headline  </title></item>
</channel></rss>`;

test("parseRssTitles extracts item titles only, decoding entities and CDATA", () => {
  assert.deepEqual(parseRssTitles(FEED), [
    "Plain headline & more",
    "CDATA headline with <b>tags</b>",
    "Trimmed 'quoted' headline",
  ]);
});

test("parseRssTitles returns [] for feeds with no items", () => {
  assert.deepEqual(parseRssTitles("<rss><channel><title>Only channel</title></channel></rss>"), []);
});

test("getHeadlines fetches and parses a feed", async () => {
  const fetchImpl: TextFetchLike = async () => ({ ok: true, async text() { return FEED; } });
  const client = createNewsClient({ fetchImpl });
  const titles = await client.getHeadlines("https://example.test/feed.rss");
  assert.equal(titles[0], "Plain headline & more");
  assert.equal(titles.length, 3);
});

test("getHeadlines throws on a non-ok response", async () => {
  const fetchImpl: TextFetchLike = async () => ({ ok: false, status: 503, async text() { return ""; } });
  const client = createNewsClient({ fetchImpl });
  await assert.rejects(() => client.getHeadlines("https://example.test/feed.rss"), /returned 503/);
});
