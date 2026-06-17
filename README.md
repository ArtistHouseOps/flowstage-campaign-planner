# Flowstage Campaign Planner

Plan and queue multi-day Flowstage posting campaigns. Default: 14 days &times; 3 posts/day = 42 posts.

This repo currently covers **Phase 1 + 2** of the build spec — foundation and Flowstage read integration. Campaign creation, the Inngest worker, and the dashboard are not built yet.

## What's in this phase

- Next.js 16 App Router + Tailwind v4
- Typed Flowstage client (`lib/flowstage/`)
- Vercel KV / Upstash Redis client (`lib/kv.ts`) — no SQL, no ORM, no migrations
- Zod-validated env loader (`lib/env.ts`)
- Inngest client + route handler stub (no functions registered yet)
- Read endpoints: `/api/flowstage/accounts`, `/api/flowstage/aesthetics/[id]`, `/api/flowstage/limits`
- Home page that lists social accounts + monthly limits
- Account detail page that lists audios and sections from the bound aesthetic

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in FLOWSTAGE_API_KEY and KV_REST_API_*
npm run dev
```

Then open <http://localhost:3000>.

## Required environment variables

| Name | Purpose |
| --- | --- |
| `FLOWSTAGE_API_KEY` | Server-only Flowstage API key. Sent as `X-API-Key`. |
| `KV_REST_API_URL` | Upstash Redis REST URL (auto-injected by Vercel's Upstash integration). |
| `KV_REST_API_TOKEN` | Upstash Redis REST token (auto-injected). |
| `INNGEST_EVENT_KEY` | Optional in this phase. Required once the worker is wired. |
| `INNGEST_SIGNING_KEY` | Optional in this phase. Required once the worker is wired. |
| `NEXT_PUBLIC_APP_URL` | Optional. Public base URL of the deployment. |

## Provisioning Vercel KV (Upstash)

1. Push this repo to GitHub and import it in Vercel.
2. In the Vercel project, open **Storage → Create database → Upstash Redis** (the Vercel marketplace integration).
3. Choose a region near your function region.
4. Click **Connect to Project**. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` into both Preview and Production environments.
5. Pull them down locally with `vercel env pull .env.local` if you want to develop against the same instance.

The `@upstash/redis` client used here is the same one Vercel KV resells, so no code changes are needed if you later swap providers.

## Deploying to Vercel

1. Set the env vars above in **Project Settings → Environment Variables**.
2. Push to `main`. Vercel auto-detects Next.js and builds.
3. No serverless config needed for Phase 1+2. (The Inngest webhook lives at `/api/inngest` and will be picked up automatically once functions are registered.)

## Project layout

```
app/
  layout.tsx              # root shell
  page.tsx                # home: accounts list + limits
  accounts/[id]/page.tsx  # account detail: audios + sections
  api/
    flowstage/
      accounts/route.ts   # GET → /v1/social-accounts (cached in KV)
      aesthetics/[id]/route.ts
      limits/route.ts
    inngest/route.ts      # Inngest webhook (no functions yet)
lib/
  env.ts                  # Zod-validated env loader, throws on missing vars
  kv.ts                   # Upstash Redis client + key namespaces
  flowstage/
    client.ts             # Typed Flowstage HTTP client
    types.ts              # Flowstage API response types
  inngest/
    client.ts             # Inngest client (id: flowstage-campaign-planner)
```

## What's next (not built yet)

- Phase 3 — `/campaigns/new` wizard, job generation, KV persistence, quota check
- Phase 4 — Inngest worker (`process-campaign`, `process-one-campaign-job`, render polling)
- Phase 5 — Campaign list + detail dashboard, retry, pause/resume
- Phase 6 — Error handling, retry policy, rate limiting, logging
