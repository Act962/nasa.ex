import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
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

    console.log("[CREATE TASK]", input);

    const action = await prisma.action.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueDate: input.dueDate,
        startDate: input.startDate,
        workspaceId: input.workspaceId,
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
          create: {
            userId: context.user.id,
          },
        },
      },
    });

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
        featureKey: input.isPublic ? "workspace.action.created.public" : "workspace.action.created",
        action: "workspace.action.created",
        actionLabel: `Criou a ação "${action.title}"`,
        resource: action.title,
        resourceId: action.id,
        metadata: { priority: input.priority, isPublic: input.isPublic ?? false },
      });
    }

    return {
      action,
    };
  });
