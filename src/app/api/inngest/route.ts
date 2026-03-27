import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { executeWorkflow } from "@/inngest/functions";
import { bookingNotification } from "@/inngest/functions/booking-notification";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [executeWorkflow, bookingNotification],
});
