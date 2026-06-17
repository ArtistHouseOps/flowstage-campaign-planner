export type FlowstageSocialAccount = {
  id: string;
  platform: "tiktok" | "instagram" | "youtube" | string;
  handle: string;
  timezone: string;
  default_timeslots: number[];
  bound_aesthetic_id: string | null;
};

export type FlowstageAudioSection = {
  id: string;
  name: string;
  start_time: number;
  end_time: number;
};

export type FlowstageAudio = {
  id: string;
  name: string;
  duration: number;
  url: string;
  sections: FlowstageAudioSection[];
};

export type FlowstageAesthetic = {
  id: string;
  name: string;
  description?: string;
  audios: FlowstageAudio[];
  videos?: unknown[];
  photos?: unknown[];
  hooks?: { text: string }[];
  video_preset_names?: string[];
  slideshow_preset_names?: string[];
};

export type FlowstageLimits = {
  limits: {
    video_edits_per_month: number;
    posts_per_month: number;
    social_accounts?: number;
  };
  usage: {
    video_edits_per_month: number;
    posts_per_month: number;
  };
};

export type CreateVideoEditInput = {
  name?: string;
  aesthetic_id: string;
  preset_name?: string;
  hook: string;
  audio_id: string;
  section_start_time: number;
  section_end_time: number;
  render: boolean;
  is_flipbook?: boolean;
};

export type VideoEditProgress = {
  edit_id: string;
  status: "pending" | "processing" | "done" | "error";
  progress: number;
  url?: string;
  message?: string;
  error?: string | null;
};

export type SchedulePostInput = {
  video_edit_id: string;
  date?: string;
  slot_hour?: number;
  caption: string;
  hashtags?: string[];
  tt_autopublish?: boolean;
};

export type FlowstagePost = {
  id: string;
  video_edit_id: string;
  date?: string;
  slot_hour?: number;
  caption?: string;
  hashtags?: string[];
  time_scheduled?: string;
  status?: string;
};
