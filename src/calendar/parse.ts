import IcalExpander from "ical-expander";
import { melbourneDayBounds, formatMelbourneTime } from "../time.ts";

export interface ShapedEvent {
  time: string; // "All day" or a Melbourne time like "9:00 am"
  title: string;
  allDay: boolean;
}

interface RawEvent {
  start: Date;
  allDay: boolean;
  title: string;
}

const DEFAULT_LIMIT = 5;

// Expand one calendar's events/occurrences within [start, end) into RawEvents.
// Returns [] for any calendar that fails to parse, so one bad feed can't sink the rest.
function expandOne(ics: string, start: Date, end: Date): RawEvent[] {
  try {
    const expander = new IcalExpander({ ics, maxIterations: 365 });
    const { events, occurrences } = expander.between(start, end);
    const fromEvents = events.map((e) => ({
      start: e.startDate.toJSDate(),
      allDay: e.startDate.isDate,
      title: e.summary,
    }));
    const fromOccurrences = occurrences.map((o) => ({
      start: o.startDate.toJSDate(),
      allDay: o.startDate.isDate,
      title: o.item.summary,
    }));
    return [...fromEvents, ...fromOccurrences];
  } catch {
    return [];
  }
}

export function parseAgenda(
  icsTexts: string[],
  now: Date,
  { limit = DEFAULT_LIMIT }: { limit?: number } = {},
): ShapedEvent[] {
  const { start, end } = melbourneDayBounds(now);
  const raw = icsTexts.flatMap((ics) => expandOne(ics, start, end));

  return raw
    // all-day first, then by start time
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())
    .slice(0, limit)
    .map((e) => ({
      time: e.allDay ? "All day" : formatMelbourneTime(e.start),
      title: e.title,
      allDay: e.allDay,
    }));
}
