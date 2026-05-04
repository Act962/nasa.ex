import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

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
  .handler(async ({ input }) => {
    const { groupId, ...data } = input;
    const group = await prisma.subActionGroup.update({
      where: { id: groupId },
      data,
    });
    return { group };
  });
