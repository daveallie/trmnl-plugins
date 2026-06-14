import { createClient } from "redis";

export interface SummaryCache {
  get(id: number): Promise<string | null>;
  set(id: number, summary: string): Promise<void>;
}

export function createMemoryCache(): SummaryCache {
  const map = new Map<number, string>();
  return {
    async get(id) {
      return map.has(id) ? map.get(id)! : null;
    },
    async set(id, summary) {
      map.set(id, summary);
    },
  };
}

export interface RedisCacheOptions {
  url: string;
  ttlSeconds?: number;
}

const SEVEN_DAYS = 7 * 24 * 60 * 60;

// Redis-backed cache. Connection is lazy and all errors are swallowed so the
// plugin keeps working (regenerating summaries) when Redis is unavailable.
export function createRedisCache({ url, ttlSeconds = SEVEN_DAYS }: RedisCacheOptions): SummaryCache {
  const client = createClient({ url });
  client.on("error", (err: Error) => console.error("redis cache error:", err.message));

  let connecting: Promise<unknown> | null = null;
  function ensureConnected(): Promise<unknown> {
    if (!connecting) {
      // If the connection attempt fails, clear the cached promise so the next
      // get/set retries rather than re-awaiting a permanently-rejected promise.
      connecting = client.connect().catch((err: unknown) => {
        connecting = null;
        throw err;
      });
    }
    return connecting;
  }

  const key = (id: number) => `hn:summary:${id}`;

  return {
    async get(id) {
      try {
        await ensureConnected();
        return await client.get(key(id));
      } catch {
        return null;
      }
    },
    async set(id, summary) {
      try {
        await ensureConnected();
        await client.set(key(id), summary, { EX: ttlSeconds });
      } catch {
        // best-effort: ignore cache write failures
      }
    },
  };
}
