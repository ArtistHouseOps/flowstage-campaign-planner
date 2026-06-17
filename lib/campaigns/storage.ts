import { KV_KEYS, redis } from "@/lib/kv";
import type { Campaign, CampaignPostJob } from "./types";

function campaignKey(id: string) {
  return KV_KEYS.campaign(id);
}

function jobKey(id: string) {
  return `job:${id}`;
}

export async function saveCampaign(campaign: Campaign): Promise<void> {
  const r = redis();
  const score = new Date(campaign.createdAt).getTime();
  await Promise.all([
    r.set(campaignKey(campaign.id), campaign),
    r.zadd(KV_KEYS.campaignsIndex(), { score, member: campaign.id }),
  ]);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  return (await redis().get<Campaign>(campaignKey(id))) ?? null;
}

export async function updateCampaign(
  id: string,
  patch: Partial<Campaign>,
): Promise<Campaign | null> {
  const r = redis();
  const existing = await r.get<Campaign>(campaignKey(id));
  if (!existing) return null;
  const updated: Campaign = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await r.set(campaignKey(id), updated);
  return updated;
}

export async function listCampaigns(): Promise<Campaign[]> {
  const r = redis();
  const ids = await r.zrange<string[]>(KV_KEYS.campaignsIndex(), 0, -1, {
    rev: true,
  });
  if (ids.length === 0) return [];
  const items = await r.mget<(Campaign | null)[]>(...ids.map(campaignKey));
  return items.filter((c): c is Campaign => c !== null);
}

export async function saveJobs(
  campaignId: string,
  jobs: CampaignPostJob[],
): Promise<void> {
  const r = redis();
  const pipeline = r.pipeline();
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    pipeline.set(jobKey(job.id), job);
    pipeline.zadd(KV_KEYS.campaignJobs(campaignId), {
      score: i,
      member: job.id,
    });
  }
  await pipeline.exec();
}

export async function getCampaignJobs(
  campaignId: string,
): Promise<CampaignPostJob[]> {
  const r = redis();
  const ids = await r.zrange<string[]>(
    KV_KEYS.campaignJobs(campaignId),
    0,
    -1,
  );
  if (ids.length === 0) return [];
  const items = await r.mget<(CampaignPostJob | null)[]>(...ids.map(jobKey));
  return items.filter((j): j is CampaignPostJob => j !== null);
}

export async function getJob(id: string): Promise<CampaignPostJob | null> {
  return (await redis().get<CampaignPostJob>(jobKey(id))) ?? null;
}

export async function updateJob(
  id: string,
  patch: Partial<CampaignPostJob>,
): Promise<CampaignPostJob | null> {
  const r = redis();
  const existing = await r.get<CampaignPostJob>(jobKey(id));
  if (!existing) return null;
  const updated: CampaignPostJob = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await r.set(jobKey(id), updated);
  return updated;
}
