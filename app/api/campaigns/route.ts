import { NextResponse } from "next/server";
import {
  createCampaignSchema,
  createCampaignWithJobs,
  QuotaError,
} from "@/lib/campaigns/create";
import { listCampaigns } from "@/lib/campaigns/storage";
import { FlowstageError } from "@/lib/flowstage/client";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const campaigns = await listCampaigns();
    return NextResponse.json({ campaigns });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const { campaign, jobs } = await createCampaignWithJobs(parsed.data);
    await inngest.send({
      name: "campaign/process",
      data: { campaignId: campaign.id },
    });
    return NextResponse.json(
      { campaign, jobCount: jobs.length },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof QuotaError) {
      return NextResponse.json(
        {
          error: err.message,
          quota: { kind: err.kind, needed: err.needed, remaining: err.remaining },
        },
        { status: 409 },
      );
    }
    if (err instanceof FlowstageError) {
      return NextResponse.json(
        { error: err.message, body: err.body },
        { status: err.status },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
