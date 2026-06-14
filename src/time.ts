const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatMelbourneTime(date: Date): string {
  return timeFormatter.format(date).toLowerCase();
}
