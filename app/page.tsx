import Link from "next/link";
import {
  FlowstageError,
  getLimits,
  getSocialAccounts,
} from "@/lib/flowstage/client";
import type {
  FlowstageLimits,
  FlowstageSocialAccount,
} from "@/lib/flowstage/types";

export const dynamic = "force-dynamic";

type LoadResult = {
  accounts: FlowstageSocialAccount[] | null;
  limits: FlowstageLimits | null;
  envError: string | null;
  flowstageError: string | null;
};

async function load(): Promise<LoadResult> {
  try {
    const [{ accounts }, limits] = await Promise.all([
      getSocialAccounts(),
      getLimits(),
    ]);
    return { accounts, limits, envError: null, flowstageError: null };
  } catch (err) {
    if (err instanceof FlowstageError) {
      return {
        accounts: null,
        limits: null,
        envError: null,
        flowstageError: err.message,
      };
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    const isEnvIssue = message.startsWith("Invalid environment variables");
    return {
      accounts: null,
      limits: null,
      envError: isEnvIssue ? message : null,
      flowstageError: isEnvIssue ? null : message,
    };
  }
}

export default async function Home() {
  const { accounts, limits, envError, flowstageError } = await load();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-10 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Flowstage Campaign Planner
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Pick an account to start a campaign. Default plan: 14 days &times; 3
            posts/day = 42 posts.
          </p>
        </div>
      </header>

      {envError ? <EnvErrorCard message={envError} /> : null}
      {flowstageError ? <FlowstageErrorCard message={flowstageError} /> : null}

      {limits ? <LimitsCard limits={limits} /> : null}

      {accounts ? <AccountsTable accounts={accounts} /> : null}
    </main>
  );
}

function EnvErrorCard({ message }: { message: string }) {
  return (
    <section className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm dark:border-amber-700 dark:bg-amber-950/30">
      <h2 className="mb-2 font-medium text-amber-900 dark:text-amber-200">
        Setup needed
      </h2>
      <p className="mb-3 text-amber-800 dark:text-amber-300">
        The app can&apos;t reach Flowstage or KV yet because required environment
        variables are missing. Copy <code>.env.example</code> to{" "}
        <code>.env.local</code> and fill in your values.
      </p>
      <pre className="overflow-x-auto rounded bg-amber-100/60 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
        {message}
      </pre>
    </section>
  );
}

function FlowstageErrorCard({ message }: { message: string }) {
  return (
    <section className="mb-8 rounded-lg border border-red-300 bg-red-50 p-5 text-sm dark:border-red-700 dark:bg-red-950/30">
      <h2 className="mb-2 font-medium text-red-900 dark:text-red-200">
        Flowstage API error
      </h2>
      <p className="text-red-800 dark:text-red-300">{message}</p>
    </section>
  );
}

function LimitsCard({ limits }: { limits: FlowstageLimits }) {
  const editsLeft =
    limits.limits.video_edits_per_month - limits.usage.video_edits_per_month;
  const postsLeft =
    limits.limits.posts_per_month - limits.usage.posts_per_month;

  return (
    <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Stat
        label="Video edits left this month"
        value={`${editsLeft} / ${limits.limits.video_edits_per_month}`}
        sub={`used ${limits.usage.video_edits_per_month}`}
      />
      <Stat
        label="Posts left this month"
        value={`${postsLeft} / ${limits.limits.posts_per_month}`}
        sub={`used ${limits.usage.posts_per_month}`}
      />
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        {sub}
      </div>
    </div>
  );
}

function AccountsTable({ accounts }: { accounts: FlowstageSocialAccount[] }) {
  if (accounts.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        No social accounts connected. Add one in Flowstage to get started.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Account</th>
            <th className="px-4 py-3 font-medium">Platform</th>
            <th className="px-4 py-3 font-medium">Timezone</th>
            <th className="px-4 py-3 font-medium">Bound aesthetic</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => {
            const ready = Boolean(a.bound_aesthetic_id);
            return (
              <tr
                key={a.id}
                className="border-t border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-4 py-3 font-medium">@{a.handle}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {a.platform}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {a.timezone}
                </td>
                <td className="px-4 py-3">
                  {ready ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      not bound
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {ready ? (
                    <Link
                      href={`/accounts/${a.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View snippets &rarr;
                    </Link>
                  ) : (
                    <span className="text-xs text-zinc-400">
                      bind an aesthetic in Flowstage
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
