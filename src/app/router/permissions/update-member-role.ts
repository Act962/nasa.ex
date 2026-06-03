import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { guardBillingRoleExit } from "@/features/billing/lib/guard-billing-role-exit";
import {
  BILLING_ROLES,
  recomputeOrgPlan,
} from "@/features/billing/lib/sync-billing-role-plan-to-orgs";

export const updateMemberRole = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    memberId: z.string(),
    role: z.enum(["owner", "admin", "member", "moderador"]),
  }))
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    // Only owner or moderador can change roles
    const currentMember = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: context.user.id },
    });
    if (!currentMember || !["owner", "moderador"].includes(currentMember.role)) {
      throw new ORPCError("FORBIDDEN", { message: "Sem permissão para alterar cargos" });
    }

    const target = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId: orgId },
      include: { user: true },
    });
    if (!target) throw new ORPCError("NOT_FOUND", { message: "Membro não encontrado" });

    // Cannot downgrade yourself if you're the only owner
    if (target.userId === context.user.id && input.role !== "owner") {
      const ownerCount = await prisma.member.count({ where: { organizationId: orgId, role: "owner" } });
      if (ownerCount <= 1) throw new ORPCError("BAD_REQUEST", { message: "A empresa precisa de pelo menos 1 Master" });
    }

    // Bloqueia demoção de billing-role → não billing-role se o target é o
    // único pagante (caso 12 de docs/subscription-org-model.md). Promoção e
    // troca entre billing-roles (owner↔admin) passa direto.
    const wasBillingRole = (BILLING_ROLES as readonly string[]).includes(target.role);
    const willBeBillingRole = (BILLING_ROLES as readonly string[]).includes(input.role);
    if (wasBillingRole && !willBeBillingRole) {
      const billingGuard = await guardBillingRoleExit({
        userId: target.userId,
        organizationId: orgId,
      });
      if (billingGuard) {
        throw new ORPCError("BAD_REQUEST", { message: billingGuard.reason });
      }
    }

    await prisma.member.update({
      where: { id: input.memberId },
      data: { role: input.role },
    });

    // Promoção pra billing-role: target pode passar a cobrir a org com sua sub
    // (caso 14). Demoção: rederive sem ele (sai do scope).
    if (wasBillingRole !== willBeBillingRole) {
      try {
        await recomputeOrgPlan(orgId);
      } catch (e) {
        console.error("[billing] recomputeOrgPlan after role change failed:", e);
      }
    }

    // Log
    await prisma.orgActivityLog.create({
      data: {
        organizationId: orgId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        action: "role_changed",
        resource: target.user.email,
        resourceId: target.userId,
        metadata: { from: target.role, to: input.role },
      },
    });

    return { success: true };
  });
