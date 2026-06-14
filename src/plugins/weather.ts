export interface LatLon {
  latitude: number;
  longitude: number;
}

// Parses "lat,lon" (e.g. "-37.81,144.96"). Returns null for anything malformed
// or out of range (lat -90..90, lon -180..180).
export function parseLatLon(raw: string | undefined): LatLon | null {
  if (raw === undefined) return null;
  const parts = raw.split(",");
  if (parts.length !== 2) return null;
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (parts[0]?.trim() === "" || parts[1]?.trim() === "") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

// Degrees (0-360, N=0, clockwise) → 8-point compass label.
export function degToCompass(deg: number): string {
  return COMPASS[Math.round(deg / 45) % 8]!;
}
