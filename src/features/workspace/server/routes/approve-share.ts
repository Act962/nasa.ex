import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const approveShare = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    shareId: z.string(),
    targetWorkspaceId: z.string(),
    targetColumnId: z.string(),
  }))
  .handler(async ({ input, context }) => {
    // Verify share belongs to this org and is pending
    const share = await prisma.actionShare.findFirst({
      where: { id: input.shareId, targetOrgId: context.org.id, status: "PENDING" },
      include: {
        sourceAction: true,
      },
    });
    if (!share) throw new Error("Pedido de compartilhamento não encontrado ou já processado");

    // Verify master role (owner)
    const member = await prisma.member.findFirst({
      where: { userId: context.user.id, organizationId: context.org.id },
    });
    if (!member || member.role !== "owner") {
      throw new Error("Apenas o master da empresa pode aprovar compartilhamentos");
    }

    const source = share.sourceAction;

    // Copy the action into target org
    const copiedAction = await prisma.action.create({
      data: {
        title: source.title,
        description: source.description,
        workspaceId: input.targetWorkspaceId,
        columnId: input.targetColumnId,
        organizationId: context.org.id,
        priority: source.priority,
        type: source.type,
        order: source.order,
        createdBy: context.user.id,
        attachments: source.attachments as any,
        links: source.links as any,
        coverImage: source.coverImage,
        youtubeUrl: source.youtubeUrl,
        history: [{
          type: "shared",
          from: share.sourceOrgId,
          shareId: share.id,
          userId: context.user.id,
          timestamp: new Date().toISOString(),
        }],
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
