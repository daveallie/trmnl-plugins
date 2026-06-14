export type IconKey =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder";

export interface WeatherIcon {
  icon: IconKey;
  label: string;
}

// WMO weather code → category. https://open-meteo.com/en/docs (weather_code).
const CODE_MAP: Record<number, WeatherIcon> = {
  0: { icon: "clear", label: "Clear" },
  1: { icon: "partly", label: "Mainly clear" },
  2: { icon: "partly", label: "Partly cloudy" },
  3: { icon: "cloudy", label: "Cloudy" },
  45: { icon: "fog", label: "Fog" },
  48: { icon: "fog", label: "Fog" },
  51: { icon: "drizzle", label: "Drizzle" },
  53: { icon: "drizzle", label: "Drizzle" },
  55: { icon: "drizzle", label: "Drizzle" },
  56: { icon: "drizzle", label: "Drizzle" },
  57: { icon: "drizzle", label: "Drizzle" },
  61: { icon: "rain", label: "Rain" },
  63: { icon: "rain", label: "Rain" },
  65: { icon: "rain", label: "Rain" },
  66: { icon: "rain", label: "Rain" },
  67: { icon: "rain", label: "Rain" },
  80: { icon: "rain", label: "Rain" },
  81: { icon: "rain", label: "Rain" },
  82: { icon: "rain", label: "Rain" },
  71: { icon: "snow", label: "Snow" },
  73: { icon: "snow", label: "Snow" },
  75: { icon: "snow", label: "Snow" },
  77: { icon: "snow", label: "Snow" },
  85: { icon: "snow", label: "Snow" },
  86: { icon: "snow", label: "Snow" },
  95: { icon: "thunder", label: "Thunderstorm" },
  96: { icon: "thunder", label: "Thunderstorm" },
  99: { icon: "thunder", label: "Thunderstorm" },
};

export function weatherCodeToIcon(code: number): WeatherIcon {
  return CODE_MAP[code] ?? { icon: "cloudy", label: "Unknown" };
}
