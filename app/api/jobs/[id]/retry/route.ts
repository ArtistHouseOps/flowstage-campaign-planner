import { NextResponse } from "next/server";
import { getJob } from "@/lib/campaigns/storage";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "FAILED") {
    return NextResponse.json(
      { error: `Cannot retry from status ${job.status}` },
      { status: 409 },
    );
  }
  await inngest.send({
    name: "job/retry",
    data: { jobId: id },
  });
  return NextResponse.json({ queued: true });
}
