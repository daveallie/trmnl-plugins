import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryCache } from "../src/cache.ts";

test("createMemoryCache returns null for a missing key", async () => {
  const cache = createMemoryCache();
  assert.equal(await cache.get(123), null);
});

test("createMemoryCache returns a stored value", async () => {
  const cache = createMemoryCache();
  await cache.set(123, "a summary");
  assert.equal(await cache.get(123), "a summary");
});
