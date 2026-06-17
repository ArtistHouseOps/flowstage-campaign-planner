import { NextResponse } from "next/server";
import { getCampaign, updateCampaign } from "@/lib/campaigns/storage";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const c = await getCampaign(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.status !== "PAUSED") {
    return NextResponse.json(
      { error: `Cannot resume from status ${c.status}` },
      { status: 409 },
    );
  }
  const updated = await updateCampaign(id, { status: "ACTIVE" });
  await inngest.send({
    name: "campaign/process",
    data: { campaignId: id },
  });
  return NextResponse.json({ campaign: updated });
}
