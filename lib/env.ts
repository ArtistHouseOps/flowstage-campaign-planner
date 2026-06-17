import { z } from "zod";

const schema = z
  .object({
    FLOWSTAGE_API_KEY: z.string().min(1, "FLOWSTAGE_API_KEY is required"),
    KV_REST_API_URL: z.string().optional(),
    KV_REST_API_TOKEN: z.string().optional(),
    KV_MOCK: z.string().optional(),
    INNGEST_EVENT_KEY: z.string().optional(),
    INNGEST_SIGNING_KEY: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().optional(),
  })
  .refine(
    (d) =>
      d.KV_MOCK === "true" || (d.KV_REST_API_URL && d.KV_REST_API_TOKEN),
    {
      message:
        "KV not configured: set KV_REST_API_URL + KV_REST_API_TOKEN, or KV_MOCK=true for in-memory KV (dev only).",
      path: ["KV_REST_API_URL"],
    },
  );

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
