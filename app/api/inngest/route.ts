import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import {
  processCampaign,
  retryJob,
} from "@/lib/inngest/functions/process-campaign";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processCampaign, retryJob],
});
