export type CampaignStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETE"
  | "CANCELLED"
  | "ERROR";

export type CampaignJobStatus =
  | "QUEUED"
  | "CREATING_EDIT"
  | "EDIT_CREATED"
  | "RENDERING"
  | "RENDERED"
  | "SCHEDULING"
  | "SCHEDULED"
  | "FAILED"
  | "CANCELLED";

export type CampaignSnippet = {
  audioId: string;
  audioName?: string;
  sectionId?: string;
  sectionName?: string;
  sectionStartTime: number;
  sectionEndTime: number;
};

export type Campaign = {
  id: string;
  name: string;

  flowstageAccountId: string;
  accountHandle?: string;
  platform?: string;
  timezone?: string;

  aestheticId: string;
  snippets: CampaignSnippet[];

  presetName?: string;
  startDate: string;
  durationDays: number;
  postsPerDay: number;
  totalPosts: number;

  captionTemplate?: string;
  hashtags?: string[];
  hooks?: string[];

  status: CampaignStatus;

  createdAt: string;
  updatedAt: string;
};

export type CampaignPostJob = {
  id: string;
  campaignId: string;

  flowstageAccountId: string;
  aestheticId: string;
  audioId: string;
  audioName?: string;
  sectionName?: string;
  sectionStartTime: number;
  sectionEndTime: number;
  presetName?: string;

  targetDate: string;
  targetSlotHour: number | null;

  hook: string;
  caption: string;
  hashtags: string[];

  status: CampaignJobStatus;

  flowstageVideoEditId: string | null;
  renderStatus: string | null;
  renderProgress: number | null;
  renderUrl: string | null;
  flowstagePostId: string | null;
  scheduledTime: string | null;

  errorMessage: string | null;
  attempts: number;

  createdAt: string;
  updatedAt: string;
};

export type CampaignWithJobs = {
  campaign: Campaign;
  jobs: CampaignPostJob[];
};
