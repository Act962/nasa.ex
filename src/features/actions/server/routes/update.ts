import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { awardPoints } from "@/app/router/space-point/utils";
import { generatePublicSlug } from "@/features/public-calendar/utils/slug";
import { logActivity } from "@/lib/activity-logger";

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

export const updateAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      columnId: z.string().nullable().optional(),
      dueDate: z.date().nullable().optional(),
      startDate: z.date().nullable().optional(),
      endDate: z.date().nullable().optional(),
      isDone: z.boolean().optional(),
      orgProjectId: z.string().nullable().optional(),
      // ─── Calendário Público ──────────────────────────────────────────
      isPublic: z.boolean().optional(),
      eventCategory: z.enum(EVENT_CATEGORY_VALUES).nullable().optional(),
      country: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      registrationUrl: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { actionId, ...data } = input;
    const { session } = context;

    const previous = await prisma.action.findUnique({
      where: { id: actionId },
    });

    // Ao publicar pela 1ª vez: gerar publicSlug único + setar publishedAt
    let publicSlug: string | undefined;
    let publishedAt: Date | null | undefined;
    if (data.isPublic === true && previous && !previous.publicSlug) {
      // tenta até 3x caso colida com um slug existente
      for (let i = 0; i < 3; i++) {
        const candidate = generatePublicSlug(previous.title);
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
    } else if (data.isPublic === false && previous?.isPublic) {
      // Despublicar: mantém o slug mas limpa publishedAt
      publishedAt = null;
    }

    const action = await prisma.action.update({
      where: { id: actionId },
      data: {
        ...data,
        ...(publicSlug ? { publicSlug } : {}),
        ...(publishedAt !== undefined ? { publishedAt } : {}),
        closedAt:
          data.isDone === true
            ? new Date()
            : data.isDone === false
              ? null
              : undefined,
      },
    });

    // Somente pontua quando transiciona de não-feito para concluído
    if (previous && !previous.isDone && data.isDone === true) {
      const orgId = session.activeOrganizationId;
      if (orgId) {
        await awardPoints(
          previous.createdBy,
          orgId,
          "complete_card",
          "Card concluído ✅",
        );
      }
    }

    const orgId = session.activeOrganizationId;
    if (orgId) {
      const changedFields: string[] = [];
      if (data.title !== undefined && previous && data.title !== previous.title) changedFields.push("title");
      if (data.description !== undefined && previous && data.description !== previous.description) changedFields.push("description");
      if (data.priority !== undefined && previous && data.priority !== previous.priority) changedFields.push("priority");
      if (data.columnId !== undefined && previous && data.columnId !== previous.columnId) changedFields.push("columnId");
      if (data.dueDate !== undefined) changedFields.push("dueDate");
      if (data.isPublic !== undefined && previous && data.isPublic !== previous.isPublic) changedFields.push("isPublic");

      let featureKey = "workspace.action.updated";
      let actionLabel = `Atualizou a ação "${action.title}"`;
      if (data.isDone === true && previous && !previous.isDone) {
        featureKey = "workspace.action.completed";
        actionLabel = `Concluiu a ação "${action.title}"`;
      } else if (data.isDone === false && previous?.isDone) {
        featureKey = "workspace.action.reopened";
        actionLabel = `Reabriu a ação "${action.title}"`;
      } else if (data.isPublic === true && previous && !previous.isPublic) {
        featureKey = "workspace.action.published";
        actionLabel = `Publicou a ação "${action.title}" no calendário público`;
      } else if (data.columnId !== undefined && previous && data.columnId !== previous.columnId) {
        featureKey = "workspace.action.moved";
        actionLabel = `Moveu a ação "${action.title}" entre colunas`;
      }

      await logActivity({
        organizationId: orgId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "workspace",
        subAppSlug: "workspace-actions",
        featureKey,
        action: featureKey,
        actionLabel,
        resource: action.title,
        resourceId: action.id,
        metadata: { changedFields },
      });
    }

    return { action };
  });
