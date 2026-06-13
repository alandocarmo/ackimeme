import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;

if (process.env.REDIS_URL) {
  redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      tls: process.env.REDIS_URL.startsWith('rediss://'),
      // PERF-05: Reconnect strategy with exponential backoff (max 30s)
      reconnectStrategy: (retries: number) => {
        return Math.min(retries * 500, 30000);
      }
    } as any
  }) as RedisClientType;
  
  redisClient.on("error", (err: any) => console.error("[Redis] Client error:", err.message));
  redisClient.on("reconnecting", () => console.warn("[Redis] Reconnecting..."));
  
  // We don't await connect here to keep the module synchronous.
  // main.ts will call connect() on startup.
}

export { redisClient };
