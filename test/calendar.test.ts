import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAgenda } from "../src/calendar/parse.ts";

const ICS = await readFile(new URL("./fixtures/briefing-calendar.ics", import.meta.url), "utf8");
const NOW = new Date("2026-06-14T01:18:00Z"); // 11:18 Melbourne

test("parseAgenda keeps today's events, expands recurrence, sorts, and shapes them", () => {
  const events = parseAgenda([ICS], NOW);
  const titles = events.map((e) => e.title);
  assert.deepEqual(titles, ["Public holiday", "Standup", "1:1 with Sam"]);
  assert.equal(events[0]!.allDay, true);
  assert.equal(events[0]!.time, "All day");
  assert.equal(events[1]!.allDay, false);
  assert.match(events[1]!.time, /9:00\s?am/i);
  assert.match(events[2]!.time, /11:30\s?am/i);
  assert.ok(!titles.includes("Next week meeting"));
});

test("parseAgenda caps the number of events", () => {
  const events = parseAgenda([ICS], NOW, { limit: 2 });
  assert.equal(events.length, 2);
});

test("parseAgenda skips a malformed calendar without throwing", () => {
  const events = parseAgenda(["not a calendar", ICS], NOW);
  assert.ok(events.length >= 3);
});

test("parseAgenda merges multiple calendars chronologically", () => {
  const events = parseAgenda([ICS, ICS], NOW);
  assert.equal(events[0]!.title, "Public holiday");
});
