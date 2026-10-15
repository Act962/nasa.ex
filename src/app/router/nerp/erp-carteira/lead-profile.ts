import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import { isOrgAdmin } from "../_access";

// Spec 0106 (RF-8): o bloco "Carteira ERP" da ficha. A dívida só sai para admin ou quem vê o financeiro (CA-6).
export const getLeadErpProfile = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ leadId: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const organizationId = context.org.id;
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, tracking: { organizationId } },
      select: { id: true },
    });
    if (!lead) throw new ORPCError("NOT_FOUND", { message: "Lead não encontrado." });

    const profile = await prisma.leadErpProfile.findUnique({ where: { leadId: lead.id } });
    if (!profile) return { profile: null, canSeeDebt: false };

    const canSeeDebt =
      (await isOrgAdmin(organizationId, context.user.id)) ||
      (await hasAppPermission(organizationId, context.user.id, "financeiro", "canView"));

    return {
      canSeeDebt,
      profile: {
        customerCodes: profile.customerCodes,
        branchName: profile.branchName,
        consultantName: profile.consultantName,
        customerSince: profile.customerSince,
        firstPurchaseAt: profile.firstPurchaseAt,
        lastPurchaseAt: profile.lastPurchaseAt,
        lastPurchaseAmount: profile.lastPurchaseAmount?.toNumber() ?? null,
        totalPurchased: profile.totalPurchased.toNumber(),
        ordersCount: profile.ordersCount,
        isOverdue: profile.overdueAmount.toNumber() > 0,
        overdueAmount: canSeeDebt ? profile.overdueAmount.toNumber() : null,
        overdueInstallments: canSeeDebt ? profile.overdueInstallments : null,
        oldestOverdueAt: canSeeDebt ? profile.oldestOverdueAt : null,
        interests: profile.interests,
        lastProducts: profile.lastProducts,
        syncedAt: profile.syncedAt,
      },
    };
  });
