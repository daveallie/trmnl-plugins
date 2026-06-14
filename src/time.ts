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
