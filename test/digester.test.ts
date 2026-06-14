import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaudeDigester, noopDigester, type JsonFetchLike } from "../src/llm/claude.ts";

test("noopDigester returns empty string", async () => {
  assert.equal(await noopDigester(["a title"]), "");
});

test("createClaudeDigester posts titles and returns the trimmed text", async () => {
  let capturedBody = "";
  const fetchImpl: JsonFetchLike = async (_url, init) => {
    capturedBody = init.body;
    return { ok: true, async json() { return { content: [{ type: "text", text: "  Tech is busy today.  " }] }; } };
  };
  const digest = await createClaudeDigester({ apiKey: "k", fetchImpl });
  const out = await digest(["AI ships agents", "New chip is fast"]);
  assert.equal(out, "Tech is busy today.");
  assert.match(capturedBody, /AI ships agents/);
  assert.match(capturedBody, /New chip is fast/);
});

test("createClaudeDigester returns empty string on a non-ok response", async () => {
  const fetchImpl: JsonFetchLike = async () => ({ ok: false, status: 500, async json() { return {}; } });
  const digest = await createClaudeDigester({ apiKey: "k", fetchImpl });
  assert.equal(await digest(["x"]), "");
});

test("createClaudeDigester returns empty string with no titles", async () => {
  let called = false;
  const fetchImpl: JsonFetchLike = async () => { called = true; return { ok: true, async json() { return {}; } }; };
  const digest = await createClaudeDigester({ apiKey: "k", fetchImpl });
  assert.equal(await digest([]), "");
  assert.equal(called, false);
});
