import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { generatePublicSlug } from "@/features/public-calendar/utils/slug";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import {
  hasActionCreatedWorkflow,
  sendWorkspaceWorkflowEvent,
} from "@/inngest/utils";

const EVENT_CATEGORY_VALUES = [
  "WORKSHOP",
  "PALESTRA",
  "LANCAMENTO",
  "WEBINAR",
  "NETWORKING",
  "CURSO",
  "REUNIAO",
  "HACKATHON",
  "CONFERENCIA",
  "OUTRO",
] as const;

export const createAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      title: z.string().min(1, "Título é obrigatório"),
      description: z.string().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
      dueDate: z.date().optional(),
      startDate: z.date().optional(),
      workspaceId: z.string().min(1, "Workspace é obrigatório"),
      columnId: z.string().min(1, "Coluna é obrigatória"),
      orgProjectId: z.string().optional(),
      participantIds: z.array(z.string()).optional(),
      // Compartilhar com outras empresas (cross-org). Pra cada org:
      //  - Se user tem role owner/admin/moderador → cópia direta.
      //  - Se user é só member → cria ActionShare PENDING (Solicitar acesso).
      //  - Se user não é membro → ignora silenciosamente.
      targetOrgIds: z.array(z.string()).optional(),
      // ─── Calendário Público ──────────────────────────────────────────
      isPublic: z.boolean().optional(),
      eventCategory: z.enum(EVENT_CATEGORY_VALUES).nullable().optional(),
      state: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      registrationUrl: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const firstAction = await prisma.action.findFirst({
      where: {
        columnId: input.columnId,
        workspaceId: input.workspaceId,
      },
      orderBy: {
        order: "asc",
      },
    });

    let newOrder: Prisma.Decimal;

    if (firstAction) {
      newOrder = Prisma.Decimal.sub(firstAction.order, 1);
    } else {
      newOrder = new Prisma.Decimal(0);
    }

    // Se for criado já público, geramos slug único
    let publicSlug: string | undefined;
    let publishedAt: Date | undefined;
    if (input.isPublic) {
      for (let i = 0; i < 3; i++) {
        const candidate = generatePublicSlug(input.title);
        const exists = await prisma.action.findUnique({
          where: { publicSlug: candidate },
          select: { id: true },
        });
        if (!exists) {
          publicSlug = candidate;
          break;
        }
      }
      publishedAt = new Date();
    }

    const action = await prisma.action.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueDate: input.dueDate,
        startDate: input.startDate,
        workspaceId: input.workspaceId,
        // organizationId é OBRIGATÓRIO pra ação aparecer no calendário do
        // workspace — `getWorkspaceCalendar` filtra por organizationId.
        organizationId: context.org.id,
        order: newOrder,
        columnId: input.columnId,
        orgProjectId: input.orgProjectId,
        createdBy: context.user.id,
        isPublic: input.isPublic ?? false,
        publicSlug,
        publishedAt,
        eventCategory: input.eventCategory ?? undefined,
        state: input.state ?? undefined,
        city: input.city ?? undefined,
        address: input.address ?? undefined,
        registrationUrl: input.registrationUrl ?? undefined,
        participants: {
          create: Array.from(
            new Set([context.user.id, ...(input.participantIds ?? [])]),
          ).map((userId) => ({ userId })),
        },
      },
    });

    try {
      if (await hasActionCreatedWorkflow(action.workspaceId)) {
        await sendWorkspaceWorkflowEvent({
          trigger: "WS_ACTION_CREATED",
          workspaceId: action.workspaceId,
          actionId: action.id,
        });
      }
    } catch (err) {
      console.error(
        "[workspace-workflow] failed to emit action.created",
        err,
      );
    }

    const orgId = context.session.activeOrganizationId;
    if (orgId) {
      await logActivity({
        organizationId: orgId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "workspace",
        subAppSlug: "workspace-actions",
        featureKey: input.isPublic
          ? "workspace.action.created.public"
          : "workspace.action.created",
        action: "workspace_action_create",
        actionLabel: `Criou a ação "${action.title}"`,
        resource: action.title,
        resourceId: action.id,
        metadata: {
          priority: input.priority,
          isPublic: input.isPublic ?? false,
        },
      });

      await chargeStarsByAction(orgId, "workspace_action_create", {
        userId: context.user.id,
        description: `Criou ação "${action.title}"`,
        appSlug: "workspace",
      });
    }

    // ─── Compartilhamento cross-org ─────────────────────────────────────
    // Pra cada targetOrgId selecionado: cópia direta (user é owner/admin/
    // moderador) ou ActionShare PENDING (user é só member).
    const ROLES_DIRECT = ["owner", "admin", "moderador"] as const;
    const targetOrgIds = (input.targetOrgIds ?? []).filter(
      (id) => id !== context.org.id,
    );

    for (const targetOrgId of targetOrgIds) {
      try {
        const member = await prisma.member.findFirst({
          where: { userId: context.user.id, organizationId: targetOrgId },
          select: { role: true },
        });
        if (!member) continue; // user não é membro → ignora

        const canDirect = (ROLES_DIRECT as readonly string[]).includes(
          member.role,
        );

        if (canDirect) {
          // Cópia direta: cria action duplicada na org destino.
          // Pega primeiro workspace não-arquivado onde o user é membro
          // e primeira coluna por order.
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
            // Sem workspace/coluna disponível → degrade pra PENDING.
            await prisma.actionShare.create({
              data: {
                sourceActionId: action.id,
                sourceOrgId: context.org.id,
                targetOrgId,
                requestedBy: context.user.id,
                status: "PENDING",
              },
            });
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
              title: input.title,
              description: input.description,
              priority: input.priority,
              dueDate: input.dueDate,
              startDate: input.startDate,
              workspaceId: targetWorkspace.id,
              organizationId: targetOrgId,
              order: targetOrder,
              columnId: targetWorkspace.columns[0].id,
              createdBy: context.user.id,
              isPublic: input.isPublic ?? false,
              eventCategory: input.eventCategory ?? undefined,
              state: input.state ?? undefined,
              city: input.city ?? undefined,
              address: input.address ?? undefined,
              registrationUrl: input.registrationUrl ?? undefined,
              participants: {
                create: [{ userId: context.user.id }],
              },
            },
          });

          // Registra a ligação via ActionShare (status APPROVED) pra
          // manter rastreabilidade.
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
        } else {
          // User é só member → cria PENDING (mesmo flow do shareAction).
          // Evita duplicar se já houver PENDING.
          const existing = await prisma.actionShare.findFirst({
            where: {
              sourceActionId: action.id,
              targetOrgId,
              status: "PENDING",
            },
            select: { id: true },
          });
          if (existing) continue;

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
            actionLabel: `Solicitou compartilhamento de "${action.title}" com outra empresa`,
            resource: action.title,
            resourceId: action.id,
            metadata: { targetOrgId },
          });
        }
      } catch (err) {
        console.error(
          "[action.create] cross-org share failed for targetOrgId=",
          targetOrgId,
          err,
        );
      }
    }

    return {
      action,
    };
  });
