import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { logOrgActivity } from "@/features/admin/lib/org-activity-log";
import { z } from "zod";
import { copyActionToOrg } from "@/features/actions/lib/copy-action-to-org";

export const approveShare = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      shareId: z.string(),
      targetWorkspaceId: z.string(),
      targetColumnId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    // Verify share belongs to this org and is pending
    const share = await prisma.actionShare.findFirst({
      where: {
        id: input.shareId,
        targetOrgId: context.org.id,
        status: "PENDING",
      },
      select: { id: true, sourceActionId: true, sourceOrgId: true },
    });
    if (!share)
      throw new Error(
        "Pedido de compartilhamento não encontrado ou já processado",
      );

    // Verify master role (owner)
    const member = await prisma.member.findFirst({
      where: { userId: context.user.id, organizationId: context.org.id },
    });
    if (!member || member.role !== "owner") {
      throw new Error(
        "Apenas o master da empresa pode aprovar compartilhamentos",
      );
    }

    // Calcula order pra entrar no topo da coluna destino sem colidir.
    const firstInCol = await prisma.action.findFirst({
      where: {
        columnId: input.targetColumnId,
        workspaceId: input.targetWorkspaceId,
      },
      orderBy: { order: "asc" },
      select: { order: true },
    });
    const targetOrder = firstInCol
      ? Prisma.Decimal.sub(firstInCol.order, 1)
      : new Prisma.Decimal(0);

    // Copia preservando descrição, datas, anexos, links, capa, vídeo,
    // sub-ações e grupos.
    const copiedAction = await copyActionToOrg(share.sourceActionId, {
      workspaceId: input.targetWorkspaceId,
      columnId: input.targetColumnId,
      organizationId: context.org.id,
      order: targetOrder,
      createdBy: context.user.id,
    });

    await logOrgActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name ?? "Usuário",
      userEmail: context.user.email ?? "",
      action: "action.created",
      resource: "action",
      resourceId: copiedAction.id,
      metadata: {
        source: "share",
        shareId: share.id,
        fromOrgId: share.sourceOrgId,
        workspaceId: copiedAction.workspaceId,
        columnId: copiedAction.columnId,
      },
    });

    // Update share status
    const updatedShare = await prisma.actionShare.update({
      where: { id: share.id },
      data: {
        status: "APPROVED",
        approvedBy: context.user.id,
        approvedAt: new Date(),
        targetWorkspaceId: input.targetWorkspaceId,
        copiedActionId: copiedAction.id,
      },
    });

    return { share: updatedShare, copiedAction };
  });
