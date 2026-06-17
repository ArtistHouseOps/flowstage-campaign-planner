import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignDetail } from "./detail";
import { getCampaign, getCampaignJobs } from "@/lib/campaigns/storage";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();
  const jobs = await getCampaignJobs(id);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/campaigns"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        &larr; Campaigns
      </Link>
      <CampaignDetail initialCampaign={campaign} initialJobs={jobs} />
    </main>
  );
}
