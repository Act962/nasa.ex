import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findSubActionGroupInOrg } from "../lib/action-access";

export const updateSubActionGroup = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      groupId: z.string(),
      name: z.string().min(1).optional(),
      isOpen: z.boolean().optional(),
      order: z.number().int().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { groupId, ...data } = input;

    const existing = await findSubActionGroupInOrg(groupId, context.org.id);
    if (!existing) throw errors.NOT_FOUND({ message: "Grupo não encontrado" });

    const group = await prisma.subActionGroup.update({
      where: { id: groupId },
      data,
    });
    return { group };
  });
