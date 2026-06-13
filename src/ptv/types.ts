// Subset of the PTV Timetable API v3 "departures" response that this app reads.
// See https://timetableapi.ptv.vic.gov.au/swagger/ui/index for the full schema.

export interface PtvDeparture {
  stop_id?: number;
  route_id?: number;
  run_ref?: string;
  direction_id?: number;
  scheduled_departure_utc?: string | null;
  estimated_departure_utc?: string | null;
}

export interface PtvRoute {
  route_number?: string;
  route_short_name?: string;
}

export interface PtvDirection {
  direction_name?: string;
}

export interface PtvRun {
  destination_name?: string;
}

export interface PtvStop {
  stop_name?: string;
}

export interface PtvDeparturesResponse {
  departures?: PtvDeparture[];
  stops?: Record<string, PtvStop>;
  routes?: Record<string, PtvRoute>;
  directions?: Record<string, PtvDirection>;
  runs?: Record<string, PtvRun>;
}
