# Flowstage Campaign Planner

Plan and queue multi-day Flowstage posting campaigns. Default: 14 days &times; 3 posts/day = 42 posts.

End-to-end implementation of all six phases of the build spec — foundation, Flowstage reads, campaign creation, durable worker (Inngest), dashboard, and basic hardening.

## What's here

- Next.js 16 App Router + Tailwind v4
- Typed Flowstage client (`lib/flowstage/`)
- Vercel KV / Upstash Redis (`lib/kv.ts`) — no SQL, no ORM, no migrations
- Zod-validated env loader (`lib/env.ts`)
- Inngest worker that processes one job at a time per campaign
- Campaign wizard (`/campaigns/new`), campaign list (`/campaigns`), campaign detail with live polling (`/campaigns/[id]`)
- Pause / resume / cancel campaign, retry failed job
- Pre-launch monthly quota check against `/v1/limits`

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in FLOWSTAGE_API_KEY and KV_REST_API_*
npm run dev
```

Then open <http://localhost:3000>.

For the worker to actually execute jobs you need Inngest running. In a second terminal:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

The dev server discovers `processCampaign` and `retryJob` automatically.

## Required environment variables

| Name | Purpose |
| --- | --- |
| `FLOWSTAGE_API_KEY` | Server-only Flowstage API key. Sent as `X-API-Key`. |
| `KV_REST_API_URL` | Upstash Redis REST URL (auto-injected by Vercel's Upstash integration). |
| `KV_REST_API_TOKEN` | Upstash Redis REST token (auto-injected). |
| `INNGEST_EVENT_KEY` | Inngest event key. Required in production; the dev server doesn't need it. |
| `INNGEST_SIGNING_KEY` | Inngest signing key. Required in production. |
| `NEXT_PUBLIC_APP_URL` | Optional. Public base URL of the deployment. |

## Provisioning on Vercel

1. Push this repo to GitHub and import it in Vercel.
2. **Storage → Create database → Upstash Redis** (Vercel marketplace integration). Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. **Integrations → Inngest**. Vercel injects `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`. Inngest auto-discovers the function endpoint at `/api/inngest`.
4. Set `FLOWSTAGE_API_KEY` manually in **Project Settings → Environment Variables**.
5. Push to `main`. Vercel builds and deploys.

Pull env vars locally with `vercel env pull .env.local` if you want to share state with prod.

## How the queue works

This is the single most important behavior — campaigns must drip-feed video creation, not parallelize.

1. `POST /api/campaigns` validates input, runs a quota check against `/v1/limits`, persists the campaign + every planned job (status `QUEUED`), and sends a `campaign/process` event to Inngest.
2. `processCampaign` (`lib/inngest/functions/process-campaign.ts`) handles `campaign/process`. Inngest concurrency is keyed on `campaignId` with limit 1, so a single execution runs per campaign at any time.
3. Each run picks **one** queued job, claims it, calls `POST /v1/video-edits/draft` with `render: true`, then polls `GET /v1/video-edits/{edit_id}/progress` with `step.sleep("10s")` between polls (durable across Vercel cold starts).
4. On `done`, calls `POST /v1/social-accounts/{accountId}/posts` with the target date (no `slot_hour`, so Flowstage picks the first open slot — avoids collisions).
5. Sends `campaign/process` to itself to handle the next queued job. Loop terminates when no `QUEUED` jobs remain.

Pause flips `Campaign.status` to `PAUSED`; the next worker invocation sees this and returns early. Resume flips it back to `ACTIVE` and re-sends `campaign/process`. Retry on a failed job emits `job/retry`, which resets the job to `QUEUED` and re-emits `campaign/process`.

Failed jobs (any non-2xx from Flowstage) are marked `FAILED` with the error message and the campaign continues with the next queued job. No automatic retry — by design, so behavior is transparent. Manual retry button on the dashboard.

## KV data model

No tables, no migrations — just typed JSON blobs under namespaced keys.

```
flowstage:accounts         (string)       cached list of social accounts
flowstage:aesthetic:{id}   (string, 10m)  cached aesthetic
campaigns:index            (sorted set)   campaign IDs scored by createdAt ms
campaign:{id}              (string)       Campaign JSON
campaign:{id}:jobs         (sorted set)   job IDs scored by sequence index
job:{id}                   (string)       CampaignPostJob JSON
```

All reads/writes go through `lib/campaigns/storage.ts`.

## Project layout

```
app/
  layout.tsx
  page.tsx                              # home: accounts + limits
  accounts/[id]/page.tsx                # account → aesthetic snippets
  campaigns/
    page.tsx                            # campaign list
    new/page.tsx                        # 4-step wizard (client component)
    [id]/
      page.tsx                          # campaign detail (server)
      detail.tsx                        # polling client component
  api/
    flowstage/
      accounts/route.ts
      aesthetics/[id]/route.ts
      limits/route.ts
    campaigns/
      route.ts                          # GET list, POST create
      [id]/
        route.ts                        # GET detail (campaign + jobs)
        pause/route.ts
        resume/route.ts
        cancel/route.ts
    jobs/[id]/retry/route.ts
    inngest/route.ts                    # Inngest webhook
lib/
  env.ts
  kv.ts
  flowstage/
    client.ts
    types.ts
  campaigns/
    types.ts
    caption.ts                          # {hook}/{account}/{day}/{postNumber}
    storage.ts                          # all KV ops
    create.ts                           # validation + quota check + job gen
  inngest/
    client.ts
    functions/
      process-campaign.ts               # processCampaign + retryJob
```

## Known limits / trade-offs

- **Concurrency keyed on campaignId.** Two simultaneous campaigns on the *same* Flowstage account will interleave video-edit requests, which Flowstage docs caution against for clip variety. If you'll routinely run multiple campaigns per account, add a second concurrency key on `flowstageAccountId` (include it in the event payload).
- **Same-day collisions are surfaced as `FAILED`, not retried to the next day.** Spec §16 Option A. If a day has no open slot, that job fails and the user retries it from the dashboard.
- **No AI hook / caption generation.** Hooks are user-provided, one per line, rotated by `jobIndex % hooks.length`. Caption templating uses `{hook}`, `{account}`, `{day}`, `{postNumber}`.
- **Render poll budget is 60 × 10s = 10 minutes per job.** If Flowstage's `done` status takes longer, the job times out and is marked `FAILED`.
- **No auth.** Single-tenant by design — your Flowstage API key is the only secret needed. Add a middleware password gate before exposing the URL.
