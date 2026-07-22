import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { resolveWorkspaceTrackingId } from "@/features/actions/lib/workspace-tracking";
import { logOrgActivity } from "@/features/admin/lib/org-activity-log";
import { z } from "zod";

export const copyAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ actionId: z.string(), columnId: z.string().optional(), workspaceId: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const source = await prisma.action.findUnique({ where: { id: input.actionId } });
    if (!source) throw new Error("Action not found");

    // A cópia pode aterrissar em outro workspace, então o tracking é
    // resolvido do destino em vez de herdado da origem.
    const targetWorkspaceId = input.workspaceId ?? source.workspaceId;
    const trackingId = await resolveWorkspaceTrackingId(targetWorkspaceId);

    const copy = await prisma.action.create({
      data: {
        title: `${source.title} (Cópia)`,
        description: source.description,
        columnId: input.columnId ?? source.columnId,
        workspaceId: targetWorkspaceId,
        organizationId: source.organizationId,
        trackingId,
        priority: source.priority,
        type: source.type,
        order: source.order,
        createdBy: context.user.id,
        attachments: source.attachments as any,
        links: source.links as any,
      },
    });

    await logOrgActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name ?? "Usuário",
      userEmail: context.user.email ?? "",
      action: "action.created",
      resource: "action",
      resourceId: copy.id,
      metadata: {
        source: "copy",
        fromActionId: source.id,
        workspaceId: copy.workspaceId,
        columnId: copy.columnId,
      },
    });

    return { action: copy };
  });
