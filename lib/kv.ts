import { Redis } from "@upstash/redis";
import { env } from "./env";

let _redis: Redis | null = null;

export function redis(): Redis {
  if (_redis) return _redis;
  const e = env();
  _redis = new Redis({ url: e.KV_REST_API_URL, token: e.KV_REST_API_TOKEN });
  return _redis;
}

export const KV_KEYS = {
  accountsCache: () => "flowstage:accounts",
  aestheticCache: (aestheticId: string) => `flowstage:aesthetic:${aestheticId}`,
  campaign: (id: string) => `campaign:${id}`,
  campaignJobs: (id: string) => `campaign:${id}:jobs`,
  campaignsIndex: () => "campaigns:index",
} as const;
