import { Redis } from "@upstash/redis";
import { env } from "./env";
import { createMockRedis } from "./kv-mock";

let _redis: Redis | null = null;

export function redis(): Redis {
  if (_redis) return _redis;
  const e = env();
  if (e.KV_MOCK === "true") {
    _redis = createMockRedis() as unknown as Redis;
  } else if (e.KV_REST_API_URL && e.KV_REST_API_TOKEN) {
    _redis = new Redis({ url: e.KV_REST_API_URL, token: e.KV_REST_API_TOKEN });
  } else {
    throw new Error(
      "KV not configured: set KV_REST_API_URL + KV_REST_API_TOKEN, or KV_MOCK=true for in-memory KV (dev only).",
    );
  }
  return _redis;
}

export const KV_KEYS = {
  accountsCache: () => "flowstage:accounts",
  aestheticCache: (aestheticId: string) => `flowstage:aesthetic:${aestheticId}`,
  campaign: (id: string) => `campaign:${id}`,
  campaignJobs: (id: string) => `campaign:${id}:jobs`,
  campaignsIndex: () => "campaigns:index",
} as const;
