import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteAutomation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ automationId: z.string() }))
  .handler(async ({ input }) => {
    await prisma.workspaceAutomation.delete({ where: { id: input.automationId } });
    return { success: true };
  });
