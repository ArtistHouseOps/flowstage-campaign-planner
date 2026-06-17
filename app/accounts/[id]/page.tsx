import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FlowstageError,
  getAesthetic,
  getSocialAccounts,
} from "@/lib/flowstage/client";
import type {
  FlowstageAesthetic,
  FlowstageSocialAccount,
} from "@/lib/flowstage/types";

export const dynamic = "force-dynamic";

type LoadResult = {
  account: FlowstageSocialAccount | null;
  aesthetic: FlowstageAesthetic | null;
  error: string | null;
};

async function load(accountId: string): Promise<LoadResult> {
  try {
    const { accounts } = await getSocialAccounts();
    const account = accounts.find((a) => a.id === accountId) ?? null;
    if (!account) return { account: null, aesthetic: null, error: null };
    if (!account.bound_aesthetic_id) {
      return {
        account,
        aesthetic: null,
        error: "This account has no bound aesthetic in Flowstage.",
      };
    }
    const aesthetic = await getAesthetic(account.bound_aesthetic_id);
    return { account, aesthetic, error: null };
  } catch (err) {
    const message =
      err instanceof FlowstageError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";
    return { account: null, aesthetic: null, error: message };
  }
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { account, aesthetic, error } = await load(id);

  if (!account && !error) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        &larr; All accounts
      </Link>

      {account ? (
        <header className="mt-4 mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            @{account.handle}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {account.platform} &middot; {account.timezone} &middot; default slots{" "}
            {account.default_timeslots.join(", ")}
          </p>
        </header>
      ) : null}

      {error ? (
        <section className="mb-8 rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </section>
      ) : null}

      {aesthetic ? <AestheticView aesthetic={aesthetic} /> : null}
    </main>
  );
}

function AestheticView({ aesthetic }: { aesthetic: FlowstageAesthetic }) {
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Bound aesthetic
        </div>
        <div className="mt-1 text-lg font-medium">{aesthetic.name}</div>
        {aesthetic.description ? (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {aesthetic.description}
          </p>
        ) : null}
      </div>

      {aesthetic.audios.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          This aesthetic has no audios yet.
        </div>
      ) : (
        <div className="space-y-4">
          {aesthetic.audios.map((audio) => (
            <div
              key={audio.id}
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <div className="font-medium">{audio.name}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {audio.duration.toFixed(1)}s &middot; {audio.sections.length}{" "}
                  section{audio.sections.length === 1 ? "" : "s"}
                </div>
              </div>
              {audio.sections.length === 0 ? (
                <div className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                  No sections.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-2 font-medium">Section</th>
                      <th className="px-4 py-2 font-medium">Start</th>
                      <th className="px-4 py-2 font-medium">End</th>
                      <th className="px-4 py-2 font-medium">Length</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audio.sections.map((s) => (
                      <tr
                        key={s.id}
                        className="border-t border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="px-4 py-2">{s.name}</td>
                        <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                          {s.start_time.toFixed(2)}s
                        </td>
                        <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                          {s.end_time.toFixed(2)}s
                        </td>
                        <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                          {(s.end_time - s.start_time).toFixed(2)}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
