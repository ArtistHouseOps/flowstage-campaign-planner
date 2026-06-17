import { z } from "zod";
import { getLimits } from "@/lib/flowstage/client";
import { renderCaption } from "./caption";
import { saveCampaign, saveJobs } from "./storage";
import type { Campaign, CampaignPostJob } from "./types";

export const createCampaignSchema = z
  .object({
    name: z.string().min(1, "Campaign name is required"),

    flowstageAccountId: z.string().min(1),
    accountHandle: z.string().optional(),
    platform: z.string().optional(),
    timezone: z.string().optional(),

    aestheticId: z.string().min(1),
    audioId: z.string().min(1),
    audioName: z.string().optional(),
    sectionName: z.string().optional(),
    sectionStartTime: z.number().nonnegative(),
    sectionEndTime: z.number().positive(),

    presetName: z.string().optional(),
    startDate: z.string().min(1),
    durationDays: z.number().int().min(1).max(60).default(14),
    postsPerDay: z.number().int().min(1).max(4).default(3),

    hooks: z.array(z.string().min(1)).optional(),
    captionTemplate: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
  })
  .refine((d) => d.sectionEndTime > d.sectionStartTime, {
    message: "sectionEndTime must be greater than sectionStartTime",
    path: ["sectionEndTime"],
  });

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export class QuotaError extends Error {
  needed: number;
  remaining: number;
  kind: "edits" | "posts";
  constructor(kind: "edits" | "posts", needed: number, remaining: number) {
    super(
      `Not enough ${kind === "edits" ? "video edit" : "post"} capacity. Need ${needed}, have ${remaining}.`,
    );
    this.kind = kind;
    this.needed = needed;
    this.remaining = remaining;
  }
}

function buildJobs(campaign: Campaign): CampaignPostJob[] {
  const hooks =
    campaign.hooks && campaign.hooks.length > 0 ? campaign.hooks : [""];
  const template = campaign.captionTemplate?.trim() || "{hook}";

  const startMs = Date.parse(campaign.startDate);
  const jobs: CampaignPostJob[] = [];
  const now = new Date().toISOString();

  let idx = 0;
  for (let day = 0; day < campaign.durationDays; day++) {
    const date = new Date(startMs);
    date.setUTCDate(date.getUTCDate() + day);
    const dateIso = date.toISOString();
    for (let p = 0; p < campaign.postsPerDay; p++) {
      const hook = hooks[idx % hooks.length];
      const caption = renderCaption(template, {
        hook,
        account: campaign.accountHandle ?? "",
        day: day + 1,
        postNumber: p + 1,
      });
      jobs.push({
        id: crypto.randomUUID(),
        campaignId: campaign.id,

        flowstageAccountId: campaign.flowstageAccountId,
        aestheticId: campaign.aestheticId,
        audioId: campaign.audioId,
        sectionStartTime: campaign.sectionStartTime,
        sectionEndTime: campaign.sectionEndTime,
        presetName: campaign.presetName,

        targetDate: dateIso,
        targetSlotHour: null,

        hook,
        caption,
        hashtags: campaign.hashtags ?? [],

        status: "QUEUED",

        flowstageVideoEditId: null,
        renderStatus: null,
        renderProgress: null,
        renderUrl: null,
        flowstagePostId: null,
        scheduledTime: null,

        errorMessage: null,
        attempts: 0,

        createdAt: now,
        updatedAt: now,
      });
      idx++;
    }
  }
  return jobs;
}

export async function checkQuota(totalPosts: number) {
  const limits = await getLimits();
  const remainingEdits =
    limits.limits.video_edits_per_month - limits.usage.video_edits_per_month;
  const remainingPosts =
    limits.limits.posts_per_month - limits.usage.posts_per_month;

  if (remainingEdits < totalPosts) {
    throw new QuotaError("edits", totalPosts, remainingEdits);
  }
  if (remainingPosts < totalPosts) {
    throw new QuotaError("posts", totalPosts, remainingPosts);
  }
  return { remainingEdits, remainingPosts };
}

export async function createCampaignWithJobs(input: CreateCampaignInput) {
  const totalPosts = input.durationDays * input.postsPerDay;

  await checkQuota(totalPosts);

  const now = new Date().toISOString();
  const campaign: Campaign = {
    id: crypto.randomUUID(),
    name: input.name,

    flowstageAccountId: input.flowstageAccountId,
    accountHandle: input.accountHandle,
    platform: input.platform,
    timezone: input.timezone,

    aestheticId: input.aestheticId,
    audioId: input.audioId,
    audioName: input.audioName,
    sectionName: input.sectionName,
    sectionStartTime: input.sectionStartTime,
    sectionEndTime: input.sectionEndTime,

    presetName: input.presetName,
    startDate: input.startDate,
    durationDays: input.durationDays,
    postsPerDay: input.postsPerDay,
    totalPosts,

    captionTemplate: input.captionTemplate,
    hashtags: input.hashtags,
    hooks: input.hooks,

    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };

  const jobs = buildJobs(campaign);

  await saveCampaign(campaign);
  await saveJobs(campaign.id, jobs);

  return { campaign, jobs };
}
