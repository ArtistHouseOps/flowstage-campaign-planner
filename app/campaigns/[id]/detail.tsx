"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { Campaign, CampaignPostJob } from "@/lib/campaigns/types";

const TERMINAL_CAMPAIGN_STATUSES = new Set([
  "COMPLETE",
  "CANCELLED",
  "ERROR",
]);

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  ACTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PAUSED:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  COMPLETE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  CANCELLED: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  QUEUED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  CREATING_EDIT:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  EDIT_CREATED:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  RENDERING:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  RENDERED:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  SCHEDULING:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  SCHEDULED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

export function CampaignDetail({
  initialCampaign,
  initialJobs,
}: {
  initialCampaign: Campaign;
  initialJobs: CampaignPostJob[];
}) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [jobs, setJobs] = useState(initialJobs);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lastUpdatedRef = useRef<string>(new Date().toISOString());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      setCampaign(json.campaign);
      setJobs(json.jobs);
      lastUpdatedRef.current = new Date().toISOString();
    } catch {
      // ignore transient errors
    }
  }, [campaign.id]);

  useEffect(() => {
    if (TERMINAL_CAMPAIGN_STATUSES.has(campaign.status)) return;
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [campaign.status, refresh]);

  async function action(path: string) {
    setActionError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(json.error || `Failed (${res.status})`);
        return;
      }
      startTransition(refresh);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  const counts = jobs.reduce(
    (acc, j) => {
      acc[j.status] = (acc[j.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const scheduled = counts.SCHEDULED ?? 0;
  const failed = counts.FAILED ?? 0;
  const inFlight =
    (counts.CREATING_EDIT ?? 0) +
    (counts.RENDERING ?? 0) +
    (counts.SCHEDULING ?? 0) +
    (counts.RENDERED ?? 0);

  return (
    <>
      <header className="mt-4 mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {campaign.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-baseline gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <StatusPill status={campaign.status} />
            <span>@{campaign.accountHandle ?? "?"}</span>
            <span>·</span>
            <span>
              {campaign.durationDays}d × {campaign.postsPerDay}/day ={" "}
              {campaign.totalPosts} posts
            </span>
            <span>·</span>
            <span>start {campaign.startDate.slice(0, 10)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "ACTIVE" ? (
            <button
              type="button"
              onClick={() => action(`/api/campaigns/${campaign.id}/pause`)}
              disabled={pending}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              Pause
            </button>
          ) : null}
          {campaign.status === "PAUSED" ? (
            <button
              type="button"
              onClick={() => action(`/api/campaigns/${campaign.id}/resume`)}
              disabled={pending}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              Resume
            </button>
          ) : null}
          {!TERMINAL_CAMPAIGN_STATUSES.has(campaign.status) ? (
            <button
              type="button"
              onClick={() => {
                if (confirm("Cancel campaign? Queued jobs will be cancelled."))
                  action(`/api/campaigns/${campaign.id}/cancel`);
              }}
              disabled={pending}
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </header>

      {actionError ? (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
          {actionError}
        </p>
      ) : null}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Scheduled" value={`${scheduled} / ${jobs.length}`} />
        <Stat label="In flight" value={String(inFlight)} />
        <Stat label="Queued" value={String(counts.QUEUED ?? 0)} />
        <Stat
          label="Failed"
          value={String(failed)}
          accent={failed > 0 ? "danger" : "neutral"}
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">Snippet</th>
              <th className="px-3 py-2 font-medium">Hook</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Render</th>
              <th className="px-3 py-2 font-medium">Scheduled</th>
              <th className="px-3 py-2 font-medium">Error</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr
                key={j.id}
                className="border-t border-zinc-100 align-top dark:border-zinc-800"
              >
                <td className="px-3 py-2 whitespace-nowrap text-zinc-700 dark:text-zinc-200">
                  {j.targetDate.slice(0, 10)}
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                  {j.sectionName ? (
                    <div className="max-w-[14ch] truncate" title={`${j.audioName ?? ""} · ${j.sectionName}`}>
                      {j.sectionName}
                    </div>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">
                  <div className="max-w-xs truncate" title={j.hook}>
                    {j.hook || (
                      <span className="text-zinc-400">(empty)</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <StatusPill status={j.status} />
                </td>
                <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                  {j.renderProgress !== null
                    ? `${Math.round((j.renderProgress ?? 0) * 100)}%`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  {j.scheduledTime
                    ? new Date(j.scheduledTime).toLocaleString()
                    : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  {j.errorMessage ? (
                    <span title={j.errorMessage} className="block max-w-xs truncate">
                      {j.errorMessage}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {j.status === "FAILED" ? (
                    <button
                      type="button"
                      onClick={() => action(`/api/jobs/${j.id}/retry`)}
                      disabled={pending}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Retry
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string;
  accent?: "neutral" | "danger";
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-0.5 text-lg font-semibold ${
          accent === "danger" ? "text-red-700 dark:text-red-300" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
