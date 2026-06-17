import {
  createVideoEdit,
  FlowstageError,
  getVideoEditProgress,
  schedulePost,
} from "@/lib/flowstage/client";
import {
  getCampaign,
  getCampaignJobs,
  getJob,
  updateCampaign,
  updateJob,
} from "@/lib/campaigns/storage";
import { inngest } from "../client";

const MAX_RENDER_POLLS = 60;
const RENDER_POLL_INTERVAL = "10s";

function dateOnly(iso: string) {
  return iso.slice(0, 10);
}

export const processCampaign = inngest.createFunction(
  {
    id: "process-campaign",
    concurrency: { limit: 1, key: "event.data.campaignId" },
    retries: 0,
    triggers: [{ event: "campaign/process" }],
  },
  async ({ event, step }) => {
    const campaignId = (event.data as { campaignId: string }).campaignId;

    const campaign = await step.run("load-campaign", () =>
      getCampaign(campaignId),
    );

    if (!campaign) return { skipped: "no-campaign" };
    if (campaign.status !== "ACTIVE")
      return { skipped: `status:${campaign.status}` };

    const nextJob = await step.run("next-queued-job", async () => {
      const jobs = await getCampaignJobs(campaignId);
      const queued = jobs
        .filter((j: { status: string }) => j.status === "QUEUED")
        .sort(
          (a, b) =>
            new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime(),
        );
      return queued[0] ?? null;
    });

    if (!nextJob) {
      const jobs = await step.run("final-job-count", () =>
        getCampaignJobs(campaignId),
      );
      const anyActive = jobs.some(
        (j) =>
          j.status === "CREATING_EDIT" ||
          j.status === "RENDERING" ||
          j.status === "SCHEDULING",
      );
      if (!anyActive) {
        await step.run("complete-campaign", () =>
          updateCampaign(campaignId, { status: "COMPLETE" }),
        );
      }
      return { done: true };
    }

    const jobId = nextJob.id;

    const claimed = await step.run("claim-job", async () => {
      const j = await getJob(jobId);
      if (!j || j.status !== "QUEUED") return null;
      return updateJob(jobId, {
        status: "CREATING_EDIT",
        attempts: j.attempts + 1,
        errorMessage: null,
      });
    });

    if (!claimed) {
      await step.sendEvent("re-poll", {
        name: "campaign/process",
        data: { campaignId },
      });
      return { skipped: "claim-lost" };
    }

    try {
      const edit = await step.run("create-edit", async () => {
        return createVideoEdit({
          name: `${campaign.name} - ${dateOnly(claimed.targetDate)}`,
          aesthetic_id: claimed.aestheticId,
          preset_name: claimed.presetName,
          hook: claimed.hook || "Check this out",
          audio_id: claimed.audioId,
          section_start_time: claimed.sectionStartTime,
          section_end_time: claimed.sectionEndTime,
          render: true,
        });
      });

      await step.run("record-edit-id", () =>
        updateJob(jobId, {
          status: "RENDERING",
          flowstageVideoEditId: edit.video_edit_id,
          renderStatus: "processing",
          renderProgress: 0,
        }),
      );

      let renderUrl: string | undefined;
      for (let attempt = 0; attempt < MAX_RENDER_POLLS; attempt++) {
        const progress = await step.run(`poll-${attempt}`, () =>
          getVideoEditProgress(edit.video_edit_id),
        );

        await step.run(`update-progress-${attempt}`, () =>
          updateJob(jobId, {
            renderStatus: progress.status,
            renderProgress: progress.progress ?? 0,
          }),
        );

        if (progress.status === "done") {
          renderUrl = progress.url;
          break;
        }
        if (progress.status === "error") {
          throw new Error(progress.error || "Render failed");
        }

        await step.sleep(`wait-${attempt}`, RENDER_POLL_INTERVAL);
      }

      if (!renderUrl) {
        throw new Error("Render timed out after polling limit");
      }

      await step.run("mark-rendered", () =>
        updateJob(jobId, {
          status: "RENDERED",
          renderStatus: "done",
          renderProgress: 1,
          renderUrl,
        }),
      );

      await step.run("mark-scheduling", () =>
        updateJob(jobId, { status: "SCHEDULING" }),
      );

      const post = await step.run("schedule-post", () =>
        schedulePost(claimed.flowstageAccountId, {
          video_edit_id: edit.video_edit_id,
          date: dateOnly(claimed.targetDate),
          caption: claimed.caption,
          hashtags: claimed.hashtags,
        }),
      );

      await step.run("mark-scheduled", () =>
        updateJob(jobId, {
          status: "SCHEDULED",
          flowstagePostId: post.id,
          scheduledTime: post.time_scheduled ?? null,
        }),
      );
    } catch (err) {
      const message =
        err instanceof FlowstageError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      await step.run("mark-failed", () =>
        updateJob(jobId, {
          status: "FAILED",
          errorMessage: message,
        }),
      );
    }

    await step.sendEvent("continue-campaign", {
      name: "campaign/process",
      data: { campaignId },
    });

    return { jobId };
  },
);

export const retryJob = inngest.createFunction(
  {
    id: "retry-job",
    retries: 0,
    triggers: [{ event: "job/retry" }],
  },
  async ({ event, step }) => {
    const jobId = (event.data as { jobId: string }).jobId;
    const job = await step.run("load-job", () => getJob(jobId));
    if (!job) return { skipped: "no-job" };

    await step.run("reset-job", () =>
      updateJob(jobId, {
        status: "QUEUED",
        errorMessage: null,
        renderStatus: null,
        renderProgress: null,
      }),
    );

    await step.run("ensure-campaign-active", async () => {
      const c = await getCampaign(job.campaignId);
      if (c && c.status !== "ACTIVE" && c.status !== "PAUSED") {
        await updateCampaign(job.campaignId, { status: "ACTIVE" });
      }
    });

    await step.sendEvent("process-after-retry", {
      name: "campaign/process",
      data: { campaignId: job.campaignId },
    });
    return { campaignId: job.campaignId };
  },
);
