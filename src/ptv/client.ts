import { signRequest } from "./sign.ts";
import type { PtvDeparturesResponse } from "./types.ts";

const PTV_BASE = "https://timetableapi.ptv.vic.gov.au";

export interface DeparturesQuery {
  routeType: number;
  stopId: number;
  maxResults?: number;
}

export interface PtvClient {
  getDepartures(query: DeparturesQuery): Promise<PtvDeparturesResponse>;
}

// Minimal shape of the response we depend on, so a fake fetch can be injected in tests.
export interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

export type FetchLike = (url: string) => Promise<FetchResponse>;

export interface PtvClientOptions {
  userId: string;
  apiKey: string;
  fetchImpl?: FetchLike;
}

export function createPtvClient({ userId, apiKey, fetchImpl = fetch }: PtvClientOptions): PtvClient {
  async function getDepartures({
    routeType,
    stopId,
    maxResults = 5,
  }: DeparturesQuery): Promise<PtvDeparturesResponse> {
    const path =
      `/v3/departures/route_type/${routeType}/stop/${stopId}` +
      `?max_results=${maxResults}&expand=Route&expand=Direction&expand=Run&expand=Stop&devid=${userId}`;
    const signature = signRequest(apiKey, path);
    const res = await fetchImpl(`${PTV_BASE}${path}&signature=${signature}`);
    if (!res.ok) {
      throw new Error(`PTV API returned ${res.status}`);
    }
    return res.json() as Promise<PtvDeparturesResponse>;
  }
  return { getDepartures };
}
