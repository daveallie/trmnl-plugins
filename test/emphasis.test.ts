import { test } from "node:test";
import assert from "node:assert/strict";
import { emphasize } from "../src/emphasis.ts";

// Mirror the bold open tag the helper emits: the font--bold class plus an inline
// wght override (needed because .description pins font-variation-settings).
const B = `<span class="font--bold" style="font-variation-settings:'wght' 700">`;

test("emphasize leaves plain text untouched", () => {
  assert.equal(emphasize("A plain summary."), "A plain summary.");
});

test("emphasize converts **markdown** to a bold span", () => {
  assert.equal(emphasize("A **bold** word"), `A ${B}bold</span> word`);
});

test("emphasize converts multiple emphasised spans", () => {
  assert.equal(
    emphasize("**OpenAI** ships agents while **chips** get faster"),
    `${B}OpenAI</span> ships agents while ${B}chips</span> get faster`,
  );
});

test("emphasize HTML-escapes content so the LLM can't inject markup", () => {
  assert.equal(emphasize("a < b & c > d"), "a &lt; b &amp; c &gt; d");
  assert.equal(emphasize("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
});

test("emphasize escapes content inside an emphasised span", () => {
  assert.equal(emphasize("**Q4 < Q3 & rising**"), `${B}Q4 &lt; Q3 &amp; rising</span>`);
});

test("emphasize spans newlines in the captured group", () => {
  assert.equal(emphasize("**a\nb**"), `${B}a\nb</span>`);
});

test("emphasize leaves an unmatched ** marker as literal escaped text", () => {
  assert.equal(emphasize("price ** units"), "price ** units");
});

test("emphasize handles the empty string", () => {
  assert.equal(emphasize(""), "");
});
