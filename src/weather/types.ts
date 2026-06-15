// Minimal shape of the Open-Meteo forecast response we depend on.
// Times are location-local naive ISO strings (e.g. "2026-06-14T11:18"); the
// location's offset from UTC is given by `utc_offset_seconds`.
export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  utc_offset_seconds: number;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  hourly: {
    time: string[];
    precipitation_probability: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    precipitation_sum: number[];
    sunrise: string[];
    sunset: string[];
  };
}
