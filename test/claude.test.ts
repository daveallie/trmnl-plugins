import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createClaudeSummarizer,
  noopSummarizer,
  type JsonFetchLike,
} from "../src/llm/claude.ts";

test("noopSummarizer always returns an empty string", async () => {
  assert.equal(await noopSummarizer({ title: "x", articleText: "y", comments: [] }), "");
});

test("createClaudeSummarizer posts to the Anthropic API and returns the text", async () => {
  const captured: { url: string; init: { method?: string; headers?: Record<string, string>; body?: string } } = {
    url: "",
    init: {},
  };
  const fetchImpl: JsonFetchLike = async (url, init) => {
    captured.url = url;
    captured.init = init;
    return { ok: true, json: async () => ({ content: [{ type: "text", text: "  A concise one-liner.  " }] }) };
  };
  const summarize = createClaudeSummarizer({ apiKey: "sk-test", fetchImpl });

  const result = await summarize({
    title: "The hidden cost of microservices",
    url: "https://blog.example.com/microservices",
    articleText: "Microservices add coordination costs.",
    comments: ["I agree.", "Modular monoliths are underrated."],
  });

  assert.equal(result, "A concise one-liner.");
  assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers?.["x-api-key"], "sk-test");
  assert.equal(captured.init.headers?.["anthropic-version"], "2023-06-01");
  assert.equal(captured.init.headers?.["content-type"], "application/json");
  const body = JSON.parse(captured.init.body!);
  assert.equal(body.model, "claude-haiku-4-5");
  assert.equal(body.max_tokens, 100);
  assert.match(body.messages[0].content, /hidden cost of microservices/);
  assert.match(body.messages[0].content, /coordination costs/);
});

test("createClaudeSummarizer returns empty string on a non-ok response", async () => {
  const summarize = createClaudeSummarizer({
    apiKey: "sk-test",
    fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }),
  });
  assert.equal(await summarize({ title: "x", articleText: "", comments: [] }), "");
});

test("createClaudeSummarizer returns empty string when fetch throws", async () => {
  const summarize = createClaudeSummarizer({
    apiKey: "sk-test",
    fetchImpl: async () => {
      throw new Error("timeout");
    },
  });
  assert.equal(await summarize({ title: "x", articleText: "", comments: [] }), "");
});
