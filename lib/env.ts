import { z } from "zod";

const schema = z.object({
  FLOWSTAGE_API_KEY: z.string().min(1, "FLOWSTAGE_API_KEY is required"),
  KV_REST_API_URL: z.string().min(1, "KV_REST_API_URL is required"),
  KV_REST_API_TOKEN: z.string().min(1, "KV_REST_API_TOKEN is required"),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
});

type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
