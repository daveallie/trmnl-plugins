export interface Config {
  ptvUserId: string;
  ptvApiKey: string;
  serverSecret: string;
  port: number;
  anthropicApiKey?: string;
  redisUrl: string;
  skipAuth: boolean;
  briefingIcsUrls: string[];
}

const REQUIRED = ["PTV_USER_ID", "PTV_API_KEY", "SERVER_SECRET"] as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  return {
    ptvUserId: env.PTV_USER_ID!,
    ptvApiKey: env.PTV_API_KEY!,
    serverSecret: env.SERVER_SECRET!,
    port: Number(env.PORT) || 8080,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    redisUrl: env.REDIS_URL || "redis://localhost:6379",
    // Escape hatch for local previews only: bypass the Bearer-token check.
    skipAuth: env.SKIP_AUTH === "true" || env.SKIP_AUTH === "1",
    briefingIcsUrls: (env.BRIEFING_ICS_URLS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== ""),
  };
}
