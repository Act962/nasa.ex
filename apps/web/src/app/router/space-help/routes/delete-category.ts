import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireModerator } from "../utils";

export const deleteCategory = base
  .use(requiredAuthMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    await requireModerator(context.user.id);
    await prisma.spaceHelpCategory.delete({ where: { id: input.id } });
    return { success: true };
  });
