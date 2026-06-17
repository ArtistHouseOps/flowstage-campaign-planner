"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { renderCaption } from "@/lib/campaigns/caption";
import type {
  FlowstageAesthetic,
  FlowstageLimits,
  FlowstageSocialAccount,
} from "@/lib/flowstage/types";

type WizardState = {
  accountId?: string;
  audioId?: string;
  audioName?: string;
  sectionId?: string;
  sectionName?: string;
  sectionStartTime?: number;
  sectionEndTime?: number;

  name: string;
  startDate: string;
  durationDays: number;
  postsPerDay: number;
  presetName?: string;
  hooksText: string;
  captionTemplate: string;
  hashtagsText: string;
};

function defaultStartDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const initialState: WizardState = {
  name: "",
  startDate: defaultStartDate(),
  durationDays: 14,
  postsPerDay: 3,
  hooksText: "",
  captionTemplate: "{hook}",
  hashtagsText: "",
};

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [state, setState] = useState<WizardState>(initialState);

  const [accounts, setAccounts] = useState<FlowstageSocialAccount[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const [aesthetic, setAesthetic] = useState<FlowstageAesthetic | null>(null);
  const [aestheticError, setAestheticError] = useState<string | null>(null);

  const [limits, setLimits] = useState<FlowstageLimits | null>(null);
  const [limitsError, setLimitsError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/flowstage/accounts", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setAccountsError(json.error || "Failed to load accounts");
          return;
        }
        setAccounts(json.accounts);
      } catch (e) {
        if (!cancelled) setAccountsError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const account = useMemo(
    () => accounts?.find((a) => a.id === state.accountId) ?? null,
    [accounts, state.accountId],
  );

  useEffect(() => {
    if (!account?.bound_aesthetic_id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/flowstage/aesthetics/${account.bound_aesthetic_id}`,
          { cache: "no-store" },
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setAestheticError(json.error || "Failed to load aesthetic");
          return;
        }
        setAesthetic(json);
      } catch (e) {
        if (!cancelled) setAestheticError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account?.bound_aesthetic_id]);

  useEffect(() => {
    if (step !== 4) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/flowstage/limits", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLimitsError(json.error || "Failed to load limits");
          return;
        }
        setLimits(json);
      } catch (e) {
        if (!cancelled) setLimitsError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  const totalPosts = state.durationDays * state.postsPerDay;
  const hooks = state.hooksText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const hashtags = state.hashtagsText
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/^#/, ""))
    .filter(Boolean)
    .map((s) => `#${s}`);

  const canProceedFrom1 = Boolean(state.accountId && account?.bound_aesthetic_id);
  const canProceedFrom2 =
    Boolean(state.audioId && state.sectionId && state.sectionEndTime);
  const canProceedFrom3 =
    state.name.trim().length > 0 &&
    state.durationDays >= 1 &&
    state.postsPerDay >= 1 &&
    state.postsPerDay <= 4 &&
    state.startDate.length > 0;

  async function launch() {
    if (!account || !aesthetic) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          flowstageAccountId: account.id,
          accountHandle: account.handle,
          platform: account.platform,
          timezone: account.timezone,
          aestheticId: aesthetic.id,
          audioId: state.audioId,
          audioName: state.audioName,
          sectionName: state.sectionName,
          sectionStartTime: state.sectionStartTime,
          sectionEndTime: state.sectionEndTime,
          presetName: state.presetName || undefined,
          startDate: state.startDate,
          durationDays: state.durationDays,
          postsPerDay: state.postsPerDay,
          hooks: hooks.length > 0 ? hooks : undefined,
          captionTemplate: state.captionTemplate || undefined,
          hashtags: hashtags.length > 0 ? hashtags : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || "Failed to launch");
        return;
      }
      router.push(`/campaigns/${json.campaign.id}`);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href="/campaigns"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        &larr; Campaigns
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <Steps step={step} />
      </header>

      {step === 1 && (
        <Step1
          accounts={accounts}
          error={accountsError}
          selectedId={state.accountId}
          onSelect={(id) =>
            setState((s) => ({
              ...s,
              accountId: id,
              audioId: undefined,
              sectionId: undefined,
            }))
          }
        />
      )}

      {step === 2 && (
        <Step2
          aesthetic={aesthetic}
          error={aestheticError}
          selectedSectionId={state.sectionId}
          onSelect={(audio, section) =>
            setState((s) => ({
              ...s,
              audioId: audio.id,
              audioName: audio.name,
              sectionId: section.id,
              sectionName: section.name,
              sectionStartTime: section.start_time,
              sectionEndTime: section.end_time,
            }))
          }
        />
      )}

      {step === 3 && (
        <Step3 state={state} aesthetic={aesthetic} onChange={setState} />
      )}

      {step === 4 && (
        <Step4
          state={state}
          totalPosts={totalPosts}
          hooks={hooks}
          hashtags={hashtags}
          limits={limits}
          limitsError={limitsError}
          submitError={submitError}
          submitting={submitting}
          onLaunch={launch}
        />
      )}

      <Nav
        step={step}
        setStep={setStep}
        canProceedFrom1={canProceedFrom1}
        canProceedFrom2={canProceedFrom2}
        canProceedFrom3={canProceedFrom3}
      />
    </main>
  );
}

function Steps({ step }: { step: number }) {
  const labels = ["Account", "Snippet", "Settings", "Preview"];
  return (
    <ol className="mt-3 flex gap-2 text-xs">
      {labels.map((label, i) => {
        const n = i + 1;
        const state =
          step > n
            ? "bg-emerald-600 text-white"
            : step === n
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${state}`}
            >
              {n}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Nav({
  step,
  setStep,
  canProceedFrom1,
  canProceedFrom2,
  canProceedFrom3,
}: {
  step: 1 | 2 | 3 | 4;
  setStep: (s: 1 | 2 | 3 | 4) => void;
  canProceedFrom1: boolean;
  canProceedFrom2: boolean;
  canProceedFrom3: boolean;
}) {
  const canNext =
    (step === 1 && canProceedFrom1) ||
    (step === 2 && canProceedFrom2) ||
    (step === 3 && canProceedFrom3);

  if (step === 4) return null;

  return (
    <div className="mt-8 flex justify-between">
      <button
        type="button"
        onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
        disabled={step === 1}
        className="rounded border border-zinc-300 px-4 py-2 text-sm disabled:opacity-30 dark:border-zinc-700"
      >
        Back
      </button>
      <button
        type="button"
        onClick={() => setStep((step + 1) as 1 | 2 | 3 | 4)}
        disabled={!canNext}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Continue
      </button>
    </div>
  );
}

function Step1({
  accounts,
  error,
  selectedId,
  onSelect,
}: {
  accounts: FlowstageSocialAccount[] | null;
  error: string | null;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (error)
    return (
      <p className="rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
        {error}
      </p>
    );
  if (!accounts) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (accounts.length === 0)
    return <p className="text-sm text-zinc-500">No accounts found.</p>;

  return (
    <div className="space-y-2">
      {accounts.map((a) => {
        const disabled = !a.bound_aesthetic_id;
        const selected = a.id === selectedId;
        return (
          <button
            key={a.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(a.id)}
            className={`block w-full rounded border p-4 text-left transition ${
              selected
                ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
                : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <div className="flex items-baseline justify-between">
              <div className="font-medium">@{a.handle}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {a.platform} · {a.timezone}
              </div>
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {a.bound_aesthetic_id
                ? "Bound aesthetic ready"
                : "No bound aesthetic — bind one in Flowstage first"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Step2({
  aesthetic,
  error,
  selectedSectionId,
  onSelect,
}: {
  aesthetic: FlowstageAesthetic | null;
  error: string | null;
  selectedSectionId?: string;
  onSelect: (
    audio: FlowstageAesthetic["audios"][number],
    section: FlowstageAesthetic["audios"][number]["sections"][number],
  ) => void;
}) {
  if (error)
    return (
      <p className="rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
        {error}
      </p>
    );
  if (!aesthetic)
    return <p className="text-sm text-zinc-500">Loading aesthetic…</p>;
  if (aesthetic.audios.length === 0)
    return (
      <p className="text-sm text-zinc-500">
        Bound aesthetic has no audios. Add one in Flowstage.
      </p>
    );

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Pick one section. Every job in the campaign uses this snippet so the
        videos stay on-brand.
      </p>
      {aesthetic.audios.map((audio) => (
        <div
          key={audio.id}
          className="rounded border border-zinc-200 dark:border-zinc-800"
        >
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <div className="font-medium">{audio.name}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {audio.duration.toFixed(1)}s · {audio.sections.length} section
              {audio.sections.length === 1 ? "" : "s"}
            </div>
          </div>
          <ul>
            {audio.sections.map((s) => {
              const selected = s.id === selectedSectionId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(audio, s)}
                    className={`flex w-full items-center justify-between border-t border-zinc-100 px-4 py-2 text-sm dark:border-zinc-800 ${
                      selected
                        ? "bg-zinc-50 dark:bg-zinc-900"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    }`}
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {s.start_time.toFixed(2)}s → {s.end_time.toFixed(2)}s (
                      {(s.end_time - s.start_time).toFixed(2)}s)
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Step3({
  state,
  aesthetic,
  onChange,
}: {
  state: WizardState;
  aesthetic: FlowstageAesthetic | null;
  onChange: (updater: (s: WizardState) => WizardState) => void;
}) {
  const presets = aesthetic?.video_preset_names ?? [];
  const total = state.durationDays * state.postsPerDay;
  return (
    <div className="space-y-5">
      <Field label="Campaign name">
        <input
          type="text"
          value={state.name}
          onChange={(e) => onChange((s) => ({ ...s, name: e.target.value }))}
          placeholder="June launch"
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Start date">
          <input
            type="date"
            value={state.startDate}
            onChange={(e) =>
              onChange((s) => ({ ...s, startDate: e.target.value }))
            }
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <Field label="Duration (days)">
          <input
            type="number"
            min={1}
            max={60}
            value={state.durationDays}
            onChange={(e) =>
              onChange((s) => ({
                ...s,
                durationDays: Math.max(1, Number(e.target.value) || 1),
              }))
            }
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <Field label="Posts per day (1-4)">
          <input
            type="number"
            min={1}
            max={4}
            value={state.postsPerDay}
            onChange={(e) =>
              onChange((s) => ({
                ...s,
                postsPerDay: Math.min(
                  4,
                  Math.max(1, Number(e.target.value) || 1),
                ),
              }))
            }
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Total posts: <span className="font-medium">{total}</span> (
        {state.durationDays} days × {state.postsPerDay}/day). Flowstage enforces
        max 4 posts/day per account.
      </p>

      {presets.length > 0 ? (
        <Field label="Preset (optional)">
          <select
            value={state.presetName ?? ""}
            onChange={(e) =>
              onChange((s) => ({
                ...s,
                presetName: e.target.value || undefined,
              }))
            }
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Default</option>
            {presets.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Hooks (one per line)">
        <textarea
          rows={4}
          value={state.hooksText}
          onChange={(e) =>
            onChange((s) => ({ ...s, hooksText: e.target.value }))
          }
          placeholder={"hook idea 1\nhook idea 2\nhook idea 3"}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Rotates across posts. If empty, every post uses an empty hook.
        </p>
      </Field>

      <Field label="Caption template">
        <textarea
          rows={3}
          value={state.captionTemplate}
          onChange={(e) =>
            onChange((s) => ({ ...s, captionTemplate: e.target.value }))
          }
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Variables: {"{hook}"}, {"{account}"}, {"{day}"}, {"{postNumber}"}.
        </p>
      </Field>

      <Field label="Hashtags (comma or space separated)">
        <textarea
          rows={2}
          value={state.hashtagsText}
          onChange={(e) =>
            onChange((s) => ({ ...s, hashtagsText: e.target.value }))
          }
          placeholder="#travel #aesthetic #fyp"
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-900"
        />
      </Field>
    </div>
  );
}

function Step4({
  state,
  totalPosts,
  hooks,
  hashtags,
  limits,
  limitsError,
  submitError,
  submitting,
  onLaunch,
}: {
  state: WizardState;
  totalPosts: number;
  hooks: string[];
  hashtags: string[];
  limits: FlowstageLimits | null;
  limitsError: string | null;
  submitError: string | null;
  submitting: boolean;
  onLaunch: () => void;
}) {
  const previewJobs = useMemo(() => {
    const sample: { date: string; postNumber: number; caption: string }[] = [];
    const start = Date.parse(state.startDate);
    const template = state.captionTemplate.trim() || "{hook}";
    const hookList = hooks.length > 0 ? hooks : [""];
    let idx = 0;
    const previewDays = Math.min(2, state.durationDays);
    for (let d = 0; d < previewDays; d++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + d);
      for (let p = 0; p < state.postsPerDay; p++) {
        const hook = hookList[idx % hookList.length];
        sample.push({
          date: date.toISOString().slice(0, 10),
          postNumber: p + 1,
          caption: renderCaption(template, {
            hook,
            account: "",
            day: d + 1,
            postNumber: p + 1,
          }),
        });
        idx++;
      }
    }
    return sample;
  }, [state, hooks]);

  const editsLeft = limits
    ? limits.limits.video_edits_per_month - limits.usage.video_edits_per_month
    : null;
  const postsLeft = limits
    ? limits.limits.posts_per_month - limits.usage.posts_per_month
    : null;
  const editsShort = editsLeft !== null && editsLeft < totalPosts;
  const postsShort = postsLeft !== null && postsLeft < totalPosts;

  return (
    <div className="space-y-6">
      <div className="rounded border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-medium">Plan</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Will create{" "}
          <span className="font-medium">{totalPosts} video edits</span> and{" "}
          <span className="font-medium">{totalPosts} scheduled posts</span> for
          campaign &quot;{state.name}&quot; over {state.durationDays} days
          starting {state.startDate}, {state.postsPerDay}/day.
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Jobs are queued one at a time so videos stay distinct.
        </p>
      </div>

      <div className="rounded border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-medium">Monthly quota</h2>
        {limitsError ? (
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {limitsError}
          </p>
        ) : !limits ? (
          <p className="mt-1 text-sm text-zinc-500">Checking…</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            <li
              className={
                editsShort
                  ? "text-red-700 dark:text-red-300"
                  : "text-zinc-700 dark:text-zinc-300"
              }
            >
              Video edits left: {editsLeft} · need {totalPosts}
              {editsShort ? " — not enough" : ""}
            </li>
            <li
              className={
                postsShort
                  ? "text-red-700 dark:text-red-300"
                  : "text-zinc-700 dark:text-zinc-300"
              }
            >
              Posts left: {postsLeft} · need {totalPosts}
              {postsShort ? " — not enough" : ""}
            </li>
          </ul>
        )}
      </div>

      <div className="rounded border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-medium">First two days preview</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Hashtags appended to each post: {hashtags.length > 0 ? hashtags.join(" ") : "(none)"}
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {previewJobs.map((j, i) => (
            <li
              key={i}
              className="rounded border border-zinc-100 p-2 dark:border-zinc-800"
            >
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {j.date} · post #{j.postNumber}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap font-mono text-xs">
                {j.caption || "(empty caption)"}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {submitError ? (
        <p className="rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
          {submitError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onLaunch}
        disabled={submitting || editsShort || postsShort}
        className="w-full rounded bg-emerald-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
      >
        {submitting ? "Launching…" : `Launch campaign (${totalPosts} posts)`}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}
