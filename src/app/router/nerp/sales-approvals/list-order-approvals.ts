import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import prisma from "@/lib/prisma";

// Spec 0104, RF-10: quem já decidiu e quem falta, na aba Pedido do chat.
export const listOrderApprovals = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("lead-produtos", "canView"))
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const [approvals, mySectors] = await Promise.all([
      prisma.catalogOrderApproval.findMany({
        where: { orderId: input.orderId, organizationId: context.org.id, status: { not: "CANCELED" } },
        orderBy: [{ round: "asc" }, { sector: "asc" }],
        select: { id: true, round: true, sector: true, status: true, note: true, proposedDeliveryAt: true, decidedAt: true, notifiedAt: true },
      }),
      prisma.salesApprover.findMany({
        where: { organizationId: context.org.id, userId: context.user.id, isActive: true },
        select: { sector: true, rounds: true },
      }),
    ]);
    return approvals.map((approval) => ({
      ...approval,
      canDecide:
        approval.status === "PENDING" &&
        mySectors.some((mine) => mine.sector === approval.sector && mine.rounds.includes(approval.round)),
    }));
  });
