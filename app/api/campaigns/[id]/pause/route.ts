import { NextResponse } from "next/server";
import { getCampaign, updateCampaign } from "@/lib/campaigns/storage";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const c = await getCampaign(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `Cannot pause from status ${c.status}` },
      { status: 409 },
    );
  }
  const updated = await updateCampaign(id, { status: "PAUSED" });
  return NextResponse.json({ campaign: updated });
}
