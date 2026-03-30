import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateAutomation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    automationId: z.string(),
    name: z.string().optional(),
    isActive: z.boolean().optional(),
    trigger: z.string().optional(),
    triggerData: z.record(z.string(), z.any()).optional(),
    conditions: z.array(z.record(z.string(), z.any())).optional(),
    steps: z.array(z.record(z.string(), z.any())).optional(),
  }))
  .handler(async ({ input }) => {
    const { automationId, ...data } = input;
    const automation = await prisma.workspaceAutomation.update({
      where: { id: automationId },
      data,
    });
    return { automation };
  });
