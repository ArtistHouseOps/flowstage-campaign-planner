import { NextResponse } from "next/server";
import {
  getCampaign,
  getCampaignJobs,
  updateCampaign,
  updateJob,
} from "@/lib/campaigns/storage";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const c = await getCampaign(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.status === "COMPLETE" || c.status === "CANCELLED") {
    return NextResponse.json(
      { error: `Already ${c.status.toLowerCase()}` },
      { status: 409 },
    );
  }

  const updated = await updateCampaign(id, { status: "CANCELLED" });

  // Mark all queued jobs as cancelled so they don't fire on a stray event.
  const jobs = await getCampaignJobs(id);
  await Promise.all(
    jobs
      .filter((j) => j.status === "QUEUED")
      .map((j) => updateJob(j.id, { status: "CANCELLED" })),
  );

  return NextResponse.json({ campaign: updated });
}
