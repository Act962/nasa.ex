import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findActionInOrg } from "../lib/action-access";

export const createSubActionGroup = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      name: z.string().min(1),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const action = await findActionInOrg(input.actionId, context.org.id);
    if (!action) throw errors.NOT_FOUND({ message: "Ação não encontrada" });

    const last = await prisma.subActionGroup.findFirst({
      where: { actionId: input.actionId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const group = await prisma.subActionGroup.create({
      data: {
        actionId: input.actionId,
        name: input.name,
        order: (last?.order ?? -1) + 1,
      },
    });

    return { group };
  });
