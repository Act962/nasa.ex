import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import { decideApprovalFromPanel, SalesApprovalError } from "@/features/nerp-catalog/lib/approvals/order-approvals";

export const decideOrderApproval = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("lead-produtos", "canView"))
  .input(
    z.object({
      approvalId: z.string().min(1),
      decision: z.enum(["approve", "reject", "adjust"]),
      note: z.string().max(500).optional(),
      proposedDeliveryAt: z.string().datetime().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      await decideApprovalFromPanel({
        organizationId: context.org.id,
        userId: context.user.id,
        approvalId: input.approvalId,
        decision: input.decision,
        note: input.note,
        proposedDeliveryAt: input.proposedDeliveryAt ? new Date(input.proposedDeliveryAt) : null,
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof SalesApprovalError) throw errors.BAD_REQUEST({ message: error.message });
      throw error;
    }
  });
