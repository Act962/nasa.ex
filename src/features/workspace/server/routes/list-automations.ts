import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listAutomations = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ workspaceId: z.string() }))
  .handler(async ({ input }) => {
    const automations = await prisma.workspaceAutomation.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return { automations };
  });
