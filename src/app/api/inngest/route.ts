import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { executeWorkflow } from "@/inngest/functions";
import { bookingNotification } from "@/inngest/functions/booking-notification";
import { processUserAction } from "@/inngest/functions/process-user-action";
import { detectAbsence } from "@/inngest/functions/crons/detect-absence";
import { detectOverdue } from "@/inngest/functions/crons/detect-overdue";
import { detectChatTimeout } from "@/inngest/functions/crons/detect-chat-timeout";
import { checkStreaks } from "@/inngest/functions/crons/check-streaks";
import { checkMilestones } from "@/inngest/functions/crons/check-milestones";
import { onProposalPaid } from "@/inngest/functions/on-proposal-paid";
import { onOnboardingFormsCompleted } from "@/inngest/functions/on-onboarding-forms-completed";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    executeWorkflow,
    bookingNotification,
    processUserAction,
    detectAbsence,
    detectOverdue,
    detectChatTimeout,
    checkStreaks,
    checkMilestones,
    onProposalPaid,
    onOnboardingFormsCompleted,
  ],
});
