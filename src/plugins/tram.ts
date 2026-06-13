import type { RequestHandler } from "express";
import type { PtvClient } from "../ptv/client.ts";
import type { PtvDeparturesResponse } from "../ptv/types.ts";

export const ROUTE_TYPE_TRAM = 1;
export const MAX_RESULTS = 5;

export interface ShapedDeparture {
  route: string;
  destination: string;
  minutes: number;
  time: string;
  realtime: boolean;
}

export interface TramData {
  stop_name: string;
  updated_at: string;
  departures: ShapedDeparture[];
}

export interface Plugin {
  name: string;
  route: string;
  handler: RequestHandler;
  // Liquid template for this plugin's TRMNL view (used by the preview route).
  templateUrl: URL;
}

export interface TramPluginOptions {
  client: PtvClient;
  now?: () => Date;
}

const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatMelbourneTime(date: Date): string {
  return timeFormatter.format(date).toLowerCase();
}

// PTV stop ids are positive integers. Returns null for anything else.
export function parseStopId(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    return null;
  }
  return Number(raw);
}

export function shapeDepartures(
  data: PtvDeparturesResponse,
  now: Date,
  { limit = MAX_RESULTS }: { limit?: number } = {},
): TramData {
  const routes = data.routes || {};
  const directions = data.directions || {};
  const runs = data.runs || {};
  const stops = data.stops || {};

  const departures = (data.departures || [])
    .map((d) => {
      const raw = d.estimated_departure_utc ?? d.scheduled_departure_utc;
      if (!raw) return null;
      const departAt = new Date(raw);
      const route = routes[String(d.route_id)] || {};
      const direction = directions[String(d.direction_id)] || {};
      const run = runs[d.run_ref ?? ""] || {};
      return {
        route: String(route.route_number ?? route.route_short_name ?? ""),
        destination: direction.direction_name ?? run.destination_name ?? "",
        minutes: Math.max(0, Math.round((departAt.getTime() - now.getTime()) / 60000)),
        time: formatMelbourneTime(departAt),
        realtime: Boolean(d.estimated_departure_utc),
        _ts: departAt.getTime(),
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => a._ts - b._ts)
    .slice(0, limit)
    .map(({ _ts, ...rest }) => rest);

  return {
    // PTV returns a single stop for a stop-specific query
    stop_name: Object.values(stops)[0]?.stop_name ?? "",
    updated_at: formatMelbourneTime(now),
    departures,
  };
}

// Fetch and shape departures for a stop. Shared by the plugin route and the preview.
export async function fetchTramData(
  client: PtvClient,
  stopId: number,
  now: Date,
): Promise<TramData> {
  const data = await client.getDepartures({
    routeType: ROUTE_TYPE_TRAM,
    stopId,
    maxResults: MAX_RESULTS,
  });
  return shapeDepartures(data, now);
}

export function createTramPlugin({ client, now = () => new Date() }: TramPluginOptions): Plugin {
  return {
    name: "tram",
    route: "/tram/:stopId",
    templateUrl: new URL("./tram.liquid", import.meta.url),
    handler: async (req, res) => {
      const stopId = parseStopId(req.params.stopId);
      if (stopId === null) {
        res.status(400).json({ error: "invalid stop id" });
        return;
      }
      try {
        res.json(await fetchTramData(client, stopId, now()));
      } catch (err) {
        res.status(502).json({ error: (err as Error).message });
      }
    },
  };
}
