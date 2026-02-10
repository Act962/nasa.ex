import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { NodeType } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createWorkflow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      trackingId: z.cuid(),
    }),
  )
  .handler(async ({ context, input }) => {
    const workflow = await prisma.workflow.create({
      data: {
        name: input.name,
        description: input.description,
        trackingId: input.trackingId,
        userId: context.user.id,
        nodes: {
          create: {
            type: NodeType.INITIAL,
            position: { x: 0, y: 0 },
            name: NodeType.INITIAL,
          },
        },
      },
    });

    return {
      id: workflow.id,
      trackingId: workflow.trackingId,
      trackingName: workflow.name,
    };
  });
