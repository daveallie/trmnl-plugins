export interface Config {
  ptvUserId: string;
  ptvApiKey: string;
  serverSecret: string;
  port: number;
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
  };
}
