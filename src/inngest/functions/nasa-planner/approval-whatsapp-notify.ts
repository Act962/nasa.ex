import { inngest } from "@/inngest/client";
import { notifyApproversOnWhatsapp } from "@/features/nasa-planner/server/approval-whatsapp";

/** Aviso de aprovação pelo WhatsApp (spec 0064, RF-4): I/O fora da requisição que enviou para aprovação. */
export const plannerApprovalWhatsappNotify = inngest.createFunction(
  { id: "nasa-planner-approval-whatsapp-notify", retries: 2 },
  { event: "nasa-planner/approval.whatsapp-notify" },
  async ({ event, step }) => {
    const { postId, approverIds } = event.data as { postId: string; approverIds: string[] };
    return step.run("avisar-aprovadores", () => notifyApproversOnWhatsapp(postId, approverIds));
  },
);
