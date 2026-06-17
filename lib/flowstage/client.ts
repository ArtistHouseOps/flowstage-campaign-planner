import { env } from "@/lib/env";
import type {
  CreateVideoEditInput,
  FlowstageAesthetic,
  FlowstageLimits,
  FlowstagePost,
  FlowstageSocialAccount,
  SchedulePostInput,
  VideoEditProgress,
} from "./types";

const FLOWSTAGE_BASE_URL = "https://api.theflowstage.com";

export class FlowstageError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "FlowstageError";
    this.status = status;
    this.body = body;
  }
}

export async function flowstageRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${FLOWSTAGE_BASE_URL}${path}`, {
    ...options,
    headers: {
      "X-API-Key": env().FLOWSTAGE_API_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "Flowstage API request failed";
    let body: unknown = null;
    try {
      body = await res.json();
      if (body && typeof body === "object" && "detail" in body) {
        const d = (body as { detail: unknown }).detail;
        if (typeof d === "string") detail = d;
      }
    } catch {
      // ignore body parse errors
    }
    throw new FlowstageError(res.status, `${res.status}: ${detail}`, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function getSocialAccounts() {
  return flowstageRequest<{ accounts: FlowstageSocialAccount[] }>(
    "/v1/social-accounts",
  );
}

export function getAesthetic(aestheticId: string) {
  return flowstageRequest<FlowstageAesthetic>(
    `/v1/aesthetics/${aestheticId}`,
  );
}

export function getLimits() {
  return flowstageRequest<FlowstageLimits>("/v1/limits");
}

export function createVideoEdit(input: CreateVideoEditInput) {
  return flowstageRequest<{
    video_edit_id: string;
    status: string;
    message: string;
  }>("/v1/video-edits/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getVideoEditProgress(editId: string) {
  return flowstageRequest<VideoEditProgress>(
    `/v1/video-edits/${editId}/progress`,
  );
}

export function schedulePost(
  accountId: string,
  input: SchedulePostInput,
) {
  return flowstageRequest<FlowstagePost>(
    `/v1/social-accounts/${accountId}/posts`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
