import Redis from "ioredis";

let client: Redis | null = null;
export function getReadCache() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 1,
      commandTimeout: 1500,
      connectTimeout: 1500,
      retryStrategy: () => null,
    });
    client.on("error", () => {});
  }
  return client;
}
