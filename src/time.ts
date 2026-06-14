const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatMelbourneTime(date: Date): string {
  return timeFormatter.format(date).toLowerCase();
}

export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .toLowerCase();
}

export function formatDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-AU", { timeZone, weekday: "short" }).format(date);
}

// hour: 0-23 local hour-of-day → "12AM", "1PM", etc.
export function formatHour12(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${period}`;
}

const MELBOURNE = "Australia/Melbourne";

// UTC offset (ms) applied to Melbourne wall-clock at the given instant.
// Derived by formatting the instant in Melbourne and reading it back as UTC.
function melbourneOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MELBOURNE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  // hour can come back as "24" at midnight in some engines; normalise.
  const hour = get("hour") % 24;
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return asUTC - at.getTime();
}

// Start (inclusive) and end (exclusive) of "today" in Melbourne, as UTC instants.
export function melbourneDayBounds(now: Date): { start: Date; end: Date } {
  const offset = melbourneOffsetMs(now);
  const local = new Date(now.getTime() + offset); // UTC fields == Melbourne wall clock
  const startLocalMs = Date.UTC(
    local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0,
  );
  const start = new Date(startLocalMs - offset);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// Melbourne local hour-of-day (0-23) for the given instant.
export function melbourneHour(now: Date): number {
  return new Date(now.getTime() + melbourneOffsetMs(now)).getUTCHours();
}

const longDateFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: MELBOURNE, weekday: "long", day: "numeric", month: "long",
});

// "Saturday 14 June"
export function formatLongDate(now: Date): string {
  return longDateFormatter.format(now);
}
