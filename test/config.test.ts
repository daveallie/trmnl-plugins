import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.ts";

const base = {
  PTV_USER_ID: "1000000",
  PTV_API_KEY: "secret-key",
  SERVER_SECRET: "bearer-token",
};

test("loadConfig returns parsed config with default port", () => {
  const cfg = loadConfig(base);
  assert.equal(cfg.ptvUserId, "1000000");
  assert.equal(cfg.ptvApiKey, "secret-key");
  assert.equal(cfg.serverSecret, "bearer-token");
  assert.equal(cfg.port, 8080);
});

test("loadConfig honours PORT override", () => {
  const cfg = loadConfig({ ...base, PORT: "3000" });
  assert.equal(cfg.port, 3000);
});

test("loadConfig defaults skipAuth to false and honours SKIP_AUTH", () => {
  assert.equal(loadConfig(base).skipAuth, false);
  assert.equal(loadConfig({ ...base, SKIP_AUTH: "true" }).skipAuth, true);
  assert.equal(loadConfig({ ...base, SKIP_AUTH: "1" }).skipAuth, true);
  assert.equal(loadConfig({ ...base, SKIP_AUTH: "false" }).skipAuth, false);
});

test("loadConfig throws listing all missing required vars", () => {
  assert.throws(() => loadConfig({}), /PTV_USER_ID.*PTV_API_KEY.*SERVER_SECRET/s);
});

test("loadConfig defaults redisUrl and leaves anthropicApiKey undefined", () => {
  const cfg = loadConfig(base);
  assert.equal(cfg.redisUrl, "redis://localhost:6379");
  assert.equal(cfg.anthropicApiKey, undefined);
});

test("loadConfig reads ANTHROPIC_API_KEY and REDIS_URL overrides", () => {
  const cfg = loadConfig({ ...base, ANTHROPIC_API_KEY: "sk-abc", REDIS_URL: "redis://cache:6379" });
  assert.equal(cfg.anthropicApiKey, "sk-abc");
  assert.equal(cfg.redisUrl, "redis://cache:6379");
});

test("loadConfig does not require the optional vars", () => {
  // base has no ANTHROPIC_API_KEY / REDIS_URL and must not throw.
  assert.doesNotThrow(() => loadConfig(base));
});
