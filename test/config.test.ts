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

test("loadConfig throws listing all missing required vars", () => {
  assert.throws(() => loadConfig({}), /PTV_USER_ID.*PTV_API_KEY.*SERVER_SECRET/s);
});
