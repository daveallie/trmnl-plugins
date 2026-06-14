import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAgenda } from "../src/calendar/parse.ts";

// briefing-calendar.ics contains:
//   - a recurring daily Standup at 09:00 Melbourne (23:00 UTC prev day)
//   - a timed 1:1 with Sam at 11:30 Melbourne on 2026-06-14
//   - an all-day Public holiday on 2026-06-14
//   - a Next week meeting on 2026-06-20 (out of range, must be excluded)
//   - a Tomorrow holiday all-day on 2026-06-15 (next-day, must be excluded)
const ICS = await readFile(new URL("./fixtures/briefing-calendar.ics", import.meta.url), "utf8");
const NOW = new Date("2026-06-14T01:18:00Z"); // 11:18 Melbourne

const ICS2 = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//test//briefing2//EN",
  "BEGIN:VEVENT",
  "UID:afternoon-sync@test",
  "DTSTART:20260614T050000Z", // 15:00 Melbourne (AEST)
  "DTEND:20260614T053000Z",
  "SUMMARY:Afternoon sync",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

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
  assert.ok(!titles.includes("Tomorrow holiday"));
});

test("parseAgenda caps the number of events", () => {
  const events = parseAgenda([ICS], NOW, { limit: 2 });
  assert.equal(events.length, 2);
});

test("parseAgenda skips a malformed calendar without throwing", () => {
  const events = parseAgenda(["not a calendar", ICS], NOW);
  assert.ok(events.length >= 3);
});

test("parseAgenda merges multiple calendars and sorts across them", () => {
  const events = parseAgenda([ICS, ICS2], NOW);
  const titles = events.map((e) => e.title);
  // all-day first, then timed ascending across BOTH calendars
  assert.deepEqual(titles, ["Public holiday", "Standup", "1:1 with Sam", "Afternoon sync"]);
  assert.match(events[3]!.time, /3:00\s?pm/i);
});
