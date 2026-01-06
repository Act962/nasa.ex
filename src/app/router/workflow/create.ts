import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createWorkflow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      trackingId: z.cuid(),
    })
  )
  .output(
    z.object({
      trackingId: z.string(),
      trackingName: z.string(),
    })
  )
  .handler(async ({ context, input }) => {
    const workflow = await prisma.workflow.create({
      data: {
        name: input.name,
        description: input.description,
        trackingId: input.trackingId,
        userId: context.user.id,
      },
    });

    return {
      trackingId: workflow.trackingId,
      trackingName: workflow.name,
    };
  });
