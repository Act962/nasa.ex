import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findActionInOrg } from "../lib/action-access";

export const reorderSubActions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      items: z
        .array(
          z.object({
            id: z.string(),
            order: z.number().int(),
            groupId: z.string().nullable().optional(),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const action = await findActionInOrg(input.actionId, context.org.id);
    if (!action) throw errors.NOT_FOUND({ message: "Ação não encontrada" });

    // Reordenar é escrita por lote: basta um id estranho no array pra mover
    // sub-ação de outra ação/org. Os ids só valem se forem todos desta ação.
    const ownedSubActions = await prisma.subActions.count({
      where: {
        id: { in: input.items.map((item) => item.id) },
        actionId: input.actionId,
      },
    });
    if (ownedSubActions !== input.items.length) {
      throw errors.FORBIDDEN({
        message: "Sub-ações não pertencem a esta ação",
      });
    }

    const targetGroupIds = [
      ...new Set(
        input.items
          .map((item) => item.groupId)
          .filter((groupId): groupId is string => Boolean(groupId)),
      ),
    ];
    if (targetGroupIds.length > 0) {
      const ownedGroups = await prisma.subActionGroup.count({
        where: { id: { in: targetGroupIds }, actionId: input.actionId },
      });
      if (ownedGroups !== targetGroupIds.length) {
        throw errors.FORBIDDEN({
          message: "Grupos não pertencem a esta ação",
        });
      }
    }

    await prisma.$transaction(
      input.items.map((item) =>
        prisma.subActions.update({
          where: { id: item.id },
          data: {
            order: item.order,
            ...(item.groupId !== undefined && { groupId: item.groupId }),
          },
        }),
      ),
    );

    return { success: true };
  });
