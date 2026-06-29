import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

export const updatePermission = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    role: z.string(),
    appKey: z.string(),
    canView: z.boolean(),
    canCreate: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    // Actions estendidas — opcionais; só interpretadas quando o app tá em
    // APPS_WITH_EXTENDED_ACTIONS (hoje "financeiro"). Pra outros apps a UI
    // não envia esses campos e o default `false` é gravado.
    canApprove: z.boolean().optional(),
    canPay:     z.boolean().optional(),
  }))
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    // Only owner (master) can change permissions
    const currentMember = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: context.user.id },
    });
    if (!currentMember || currentMember.role !== "owner") {
      throw new ORPCError("FORBIDDEN", { message: "Apenas o Master pode alterar permissões" });
    }

    // Cannot change owner permissions
    if (input.role === "owner") {
      throw new ORPCError("BAD_REQUEST", { message: "Permissões do Master não podem ser alteradas" });
    }

    const canApprove = input.canApprove ?? false;
    const canPay     = input.canPay     ?? false;

    await prisma.orgPermission.upsert({
      where: { organizationId_role_appKey: { organizationId: orgId, role: input.role, appKey: input.appKey } },
      create: {
        organizationId: orgId,
        role: input.role,
        appKey: input.appKey,
        canView: input.canView,
        canCreate: input.canCreate,
        canEdit: input.canEdit,
        canDelete: input.canDelete,
        canApprove,
        canPay,
      },
      update: {
        canView: input.canView,
        canCreate: input.canCreate,
        canEdit: input.canEdit,
        canDelete: input.canDelete,
        canApprove,
        canPay,
      },
    });

    // Log activity
    await prisma.orgActivityLog.create({
      data: {
        organizationId: orgId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        action: "permission_updated",
        resource: `${input.role}:${input.appKey}`,
        metadata: {
          canView:    input.canView,
          canCreate:  input.canCreate,
          canEdit:    input.canEdit,
          canDelete:  input.canDelete,
          canApprove,
          canPay,
        },
      },
    });

    return { success: true };
  });
