import Link from "next/link";
import { listCampaigns, getCampaignJobs } from "@/lib/campaigns/storage";
import type { Campaign, CampaignPostJob } from "@/lib/campaigns/types";

export const dynamic = "force-dynamic";

async function load() {
  try {
    const campaigns = await listCampaigns();
    const withCounts = await Promise.all(
      campaigns.map(async (c) => {
        const jobs = await getCampaignJobs(c.id);
        return { campaign: c, jobs };
      }),
    );
    return { items: withCounts, error: null as string | null };
  } catch (err) {
    return {
      items: [] as { campaign: Campaign; jobs: CampaignPostJob[] }[],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function summarize(jobs: CampaignPostJob[]) {
  let scheduled = 0;
  let failed = 0;
  let inFlight = 0;
  for (const j of jobs) {
    if (j.status === "SCHEDULED") scheduled++;
    else if (j.status === "FAILED") failed++;
    else if (
      j.status === "CREATING_EDIT" ||
      j.status === "RENDERING" ||
      j.status === "SCHEDULING" ||
      j.status === "RENDERED"
    )
      inFlight++;
  }
  return { scheduled, failed, inFlight, total: jobs.length };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  ACTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PAUSED:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  COMPLETE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  CANCELLED: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default async function CampaignsPage() {
  const { items, error } = await load();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            &larr; Home
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Campaigns
          </h1>
        </div>
        <Link
          href="/campaigns/new"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New campaign
        </Link>
      </header>

      {error ? (
        <p className="rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No campaigns yet. Start your first one.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map(({ campaign, jobs }) => {
            const s = summarize(jobs);
            return (
              <li key={campaign.id}>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="block rounded border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <div className="font-medium">{campaign.name}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        @{campaign.accountHandle ?? "?"} ·{" "}
                        {campaign.platform ?? "?"} · {campaign.durationDays}d ×{" "}
                        {campaign.postsPerDay}/day = {campaign.totalPosts} posts
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[campaign.status] ?? ""}`}
                    >
                      {campaign.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      scheduled <span className="font-medium">{s.scheduled}</span>
                      /{s.total}
                    </span>
                    {s.inFlight > 0 ? (
                      <span className="text-blue-600 dark:text-blue-400">
                        in flight {s.inFlight}
                      </span>
                    ) : null}
                    {s.failed > 0 ? (
                      <span className="text-red-600 dark:text-red-400">
                        failed {s.failed}
                      </span>
                    ) : null}
                    <span>start {campaign.startDate.slice(0, 10)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
