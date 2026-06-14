import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchArticleText, type TextFetchLike } from "../src/hn/article.ts";

const ARTICLE_HTML = `<!doctype html><html><head><title>Test Article</title></head><body>
<header><nav>Home About Contact</nav></header>
<article>
  <h1>The Title Of The Article</h1>
  <p>Microservices promise independent deployability and scaling, but they introduce
  real coordination costs that monoliths simply do not have. Network calls replace
  function calls, and every boundary becomes a place where things can fail.</p>
  <p>Teams adopting microservices often underestimate the operational burden: service
  discovery, distributed tracing, retries, and the sheer number of moving parts all
  add up. The result can be slower delivery, not faster.</p>
  <p>The pragmatic middle ground is a modular monolith, where clear internal module
  boundaries give you most of the organisational benefits without the distributed
  systems tax. Split into services only when a module's scaling needs truly diverge.</p>
</article>
<footer>Copyright 2026</footer>
</body></html>`;

function fetchReturning(html: string, ok = true): TextFetchLike {
  return async () => ({ ok, text: async () => html });
}

test("fetchArticleText extracts readable body text", async () => {
  const text = await fetchArticleText("https://blog.example.com/microservices", fetchReturning(ARTICLE_HTML));
  assert.match(text, /coordination costs/);
  assert.match(text, /modular monolith/);
  // Boilerplate nav/footer should be stripped by Readability.
  assert.doesNotMatch(text, /Home About Contact/);
});

test("fetchArticleText truncates to maxChars", async () => {
  const text = await fetchArticleText(
    "https://blog.example.com/microservices",
    fetchReturning(ARTICLE_HTML),
    50,
  );
  assert.ok(text.length <= 50, `expected <= 50 chars, got ${text.length}`);
});

test("fetchArticleText returns empty string on a non-ok response", async () => {
  const text = await fetchArticleText("https://x.test", fetchReturning("", false));
  assert.equal(text, "");
});

test("fetchArticleText returns empty string when fetch throws", async () => {
  const text = await fetchArticleText("https://x.test", async () => {
    throw new Error("DNS failure");
  });
  assert.equal(text, "");
});
