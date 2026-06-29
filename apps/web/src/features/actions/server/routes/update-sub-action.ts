import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logOrgActivity } from "@/features/admin/lib/org-activity-log";
import { z } from "zod";

export const updateSubAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      subActionId: z.string(),
      title: z.string().min(1).optional(),
      isDone: z.boolean().optional(),
      description: z.string().nullable().optional(),
      finishDate: z.date().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { subActionId, ...data } = input;

    const changedFields = Object.keys(data).filter(
      (key) => (data as Record<string, unknown>)[key] !== undefined,
    );

    const subAction = await prisma.subActions.update({
      where: { id: subActionId },
      data,
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

    if (changedFields.length > 0) {
      await logOrgActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name ?? "Usuário",
        userEmail: context.user.email ?? "",
        action: "action.checklist_updated",
        resource: "action",
        resourceId: subAction.action.id,
        metadata: {
          subActionId: subAction.id,
          title: subAction.title,
          changes: changedFields,
        },
      });
    }

    return { subAction };
  });
