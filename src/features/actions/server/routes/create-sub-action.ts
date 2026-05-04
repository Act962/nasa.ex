import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logOrgActivity } from "@/lib/org-activity-log";
import { z } from "zod";

export const createSubAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      title: z.string().min(1, "Título é obrigatório"),
      finishDate: z.date().optional(),
      groupId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const last = await prisma.subActions.findFirst({
      where: {
        actionId: input.actionId,
        groupId: input.groupId ?? null,
      },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const subAction = await prisma.subActions.create({
      data: {
        title: input.title,
        actionId: input.actionId,
        finishDate: input.finishDate,
        groupId: input.groupId ?? null,
        order: (last?.order ?? -1) + 1,
      },
      include: {
        responsibles: {
          select: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        action: {
          select: {
            id: true,
            workspaceId: true,
          },
        },
      },
    });

    await logOrgActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name ?? "Usuário",
      userEmail: context.user.email ?? "",
      action: "action.checklist_added",
      resource: "action",
      resourceId: input.actionId,
      metadata: {
        subActionId: subAction.id,
        title: subAction.title,
      },
    });

    return { subAction };
  });
