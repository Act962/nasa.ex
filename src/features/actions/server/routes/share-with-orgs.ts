import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

/**
 * Compartilha uma action existente com 1+ organizações.
 *
 * Mesma lógica do bloco cross-org em `create.ts`, porém pra action já
 * criada. Usado pelo `ActionShareTargetsField` no `ViewActionModal`.
 *
 * Pra cada targetOrgId:
 *   • Owner/admin/moderador → cópia direta (cria action duplicada)
 *   • Member                → ActionShare PENDING (Solicitar acesso)
 *   • Não-membro / org igual à corrente → ignora silenciosamente
 *
 * Idempotente: se já houver ActionShare APPROVED ou PENDING pra
 * (sourceActionId, targetOrgId), pula.
 */
const ROLES_DIRECT = ["owner", "admin", "moderador"] as const;

export const shareActionWithOrgs = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      targetOrgIds: z.array(z.string()).min(1),
    }),
  )
  .handler(async ({ input, context }) => {
    const action = await prisma.action.findFirst({
      where: { id: input.actionId, organizationId: context.org.id },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        startDate: true,
        dueDate: true,
        isPublic: true,
        eventCategory: true,
        state: true,
        city: true,
        address: true,
        registrationUrl: true,
        createdBy: true,
      },
    });
    if (!action) throw new Error("Ação não encontrada");

    // Bloqueia recompartilhamento de cópias recebidas de outras empresas.
    const isReceivedCopy = await prisma.actionShare.findFirst({
      where: { copiedActionId: action.id },
      select: { id: true },
    });
    if (isReceivedCopy) {
      throw new Error(
        "Esta ação foi recebida de outra empresa e não pode ser recompartilhada. Apenas o criador original pode compartilhar.",
      );
    }

    // Só o criador ou moderadores podem compartilhar.
    const orgMember = (context.org.members as any[]).find(
      (m: any) => m.userId === context.user.id,
    );
    const isCreator = action.createdBy === context.user.id;
    const isModerador = orgMember?.role === "moderador";
    if (!isCreator && !isModerador) {
      throw new Error(
        "Apenas o criador da ação ou moderadores podem compartilhar com outras empresas.",
      );
    }

    const targetOrgIds = input.targetOrgIds.filter(
      (id) => id !== context.org.id,
    );

    const results: Array<{
      orgId: string;
      kind: "direct" | "pending" | "skipped";
    }> = [];

    for (const targetOrgId of targetOrgIds) {
      try {
        // Se já existe share APPROVED ou PENDING, pula
        const existing = await prisma.actionShare.findFirst({
          where: {
            sourceActionId: action.id,
            targetOrgId,
            status: { in: ["PENDING", "APPROVED"] },
          },
          select: { id: true, status: true },
        });
        if (existing) {
          results.push({ orgId: targetOrgId, kind: "skipped" });
          continue;
        }

        const member = await prisma.member.findFirst({
          where: { userId: context.user.id, organizationId: targetOrgId },
          select: { role: true },
        });
        if (!member) {
          results.push({ orgId: targetOrgId, kind: "skipped" });
          continue;
        }

        const canDirect = (ROLES_DIRECT as readonly string[]).includes(
          member.role,
        );

        if (canDirect) {
          const targetWorkspace = await prisma.workspace.findFirst({
            where: {
              organizationId: targetOrgId,
              isArchived: false,
              OR: [
                { members: { some: { userId: context.user.id } } },
                { createdBy: context.user.id },
              ],
            },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              columns: {
                orderBy: { order: "asc" },
                take: 1,
                select: { id: true },
              },
            },
          });

          if (!targetWorkspace || targetWorkspace.columns.length === 0) {
            // Sem workspace/coluna → degrade pra PENDING
            await prisma.actionShare.create({
              data: {
                sourceActionId: action.id,
                sourceOrgId: context.org.id,
                targetOrgId,
                requestedBy: context.user.id,
                status: "PENDING",
              },
            });
            results.push({ orgId: targetOrgId, kind: "pending" });
            continue;
          }

          const firstInCol = await prisma.action.findFirst({
            where: {
              columnId: targetWorkspace.columns[0].id,
              workspaceId: targetWorkspace.id,
            },
            orderBy: { order: "asc" },
            select: { order: true },
          });
          const targetOrder = firstInCol
            ? Prisma.Decimal.sub(firstInCol.order, 1)
            : new Prisma.Decimal(0);

          const copiedAction = await prisma.action.create({
            data: {
              title: action.title,
              description: action.description,
              priority: action.priority,
              startDate: action.startDate,
              dueDate: action.dueDate,
              workspaceId: targetWorkspace.id,
              organizationId: targetOrgId,
              order: targetOrder,
              columnId: targetWorkspace.columns[0].id,
              createdBy: context.user.id,
              isPublic: action.isPublic,
              eventCategory: action.eventCategory ?? undefined,
              state: action.state ?? undefined,
              city: action.city ?? undefined,
              address: action.address ?? undefined,
              registrationUrl: action.registrationUrl ?? undefined,
              participants: {
                create: [{ userId: context.user.id }],
              },
            },
          });

          await prisma.actionShare.create({
            data: {
              sourceActionId: action.id,
              sourceOrgId: context.org.id,
              targetOrgId,
              targetWorkspaceId: targetWorkspace.id,
              requestedBy: context.user.id,
              status: "APPROVED",
              approvedBy: context.user.id,
              approvedAt: new Date(),
              copiedActionId: copiedAction.id,
            },
          });

          await logActivity({
            organizationId: context.org.id,
            userId: context.user.id,
            userName: context.user.name,
            userEmail: context.user.email,
            userImage: (context.user as any).image,
            appSlug: "workspace",
            subAppSlug: "workspace-actions",
            featureKey: "workspace.action.shared_direct",
            action: "workspace.action.shared_direct",
            actionLabel: `Compartilhou "${action.title}" diretamente com outra empresa`,
            resource: action.title,
            resourceId: action.id,
            metadata: { targetOrgId, copiedActionId: copiedAction.id },
          });

          results.push({ orgId: targetOrgId, kind: "direct" });
        } else {
          await prisma.actionShare.create({
            data: {
              sourceActionId: action.id,
              sourceOrgId: context.org.id,
              targetOrgId,
              requestedBy: context.user.id,
              status: "PENDING",
            },
          });

          await logActivity({
            organizationId: context.org.id,
            userId: context.user.id,
            userName: context.user.name,
            userEmail: context.user.email,
            userImage: (context.user as any).image,
            appSlug: "workspace",
            subAppSlug: "workspace-actions",
            featureKey: "workspace.action.shared_pending",
            action: "workspace.action.shared_pending",
            actionLabel: `Solicitou compartilhamento de "${action.title}"`,
            resource: action.title,
            resourceId: action.id,
            metadata: { targetOrgId },
          });

          results.push({ orgId: targetOrgId, kind: "pending" });
        }
      } catch (err) {
        console.error(
          "[action.shareWithOrgs] failed for targetOrgId=",
          targetOrgId,
          err,
        );
      }
    }

    return { results };
  });
