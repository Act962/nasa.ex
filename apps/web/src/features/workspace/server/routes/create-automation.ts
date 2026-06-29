import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createAutomation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    workspaceId: z.string(),
    name: z.string(),
    trigger: z.string(),
    triggerData: z.record(z.string(), z.any()).optional(),
    conditions: z.array(z.record(z.string(), z.any())).optional(),
    steps: z.array(z.record(z.string(), z.any())).optional(),
  }))
  .handler(async ({ input }) => {
    const automation = await prisma.workspaceAutomation.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        trigger: input.trigger,
        triggerData: input.triggerData ?? {},
        conditions: input.conditions ?? [],
        steps: input.steps ?? [],
      },
    });
    return { automation };
  });
