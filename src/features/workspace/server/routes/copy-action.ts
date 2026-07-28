import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { resolveWorkspaceTrackingId } from "@/features/actions/lib/workspace-tracking";
import { logOrgActivity } from "@/features/admin/lib/org-activity-log";
import { findColumnInOrg, findWorkspaceInOrg } from "../lib/workspace-access";
import { z } from "zod";

export const copyAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ actionId: z.string(), columnId: z.string().optional(), workspaceId: z.string().optional() }))
  .handler(async ({ input, context, errors }) => {
    // Origem escopada pela org: ler ação alheia expõe descrição, anexos e
    // links via a cópia resultante.
    const source = await prisma.action.findFirst({
      where: {
        id: input.actionId,
        workspace: { organizationId: context.org.id },
      },
    });
    if (!source) throw errors.NOT_FOUND({ message: "Ação não encontrada" });

    // Destino (quando informado) também tem que ser da org.
    if (input.columnId) {
      const targetColumn = await findColumnInOrg(input.columnId, context.org.id);
      const expectedWorkspaceId = input.workspaceId ?? source.workspaceId;
      if (!targetColumn || targetColumn.workspaceId !== expectedWorkspaceId) {
        throw errors.NOT_FOUND({ message: "Coluna não encontrada" });
      }
    } else if (input.workspaceId) {
      const targetWorkspace = await findWorkspaceInOrg(
        input.workspaceId,
        context.org.id,
      );
      if (!targetWorkspace) {
        throw errors.NOT_FOUND({ message: "Workspace não encontrado" });
      }
    }

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
