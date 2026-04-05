import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { NodeType } from "@/generated/prisma/enums";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createWorkflow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      trackingId: z.string(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    const tracking = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!tracking) {
      throw errors.BAD_REQUEST({
        message: "Tracking não encontrado",
      });
    }

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

    await logActivity({
      organizationId: tracking.organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "tracking",
      action: "workflow.created",
      actionLabel: `Criou o workflow "${workflow.name}" no tracking "${tracking.name}"`,
      resource: workflow.name,
      resourceId: workflow.id,
      metadata: { trackingName: tracking.name },
    });

    return {
      id: workflow.id,
      trackingId: workflow.trackingId,
      trackingName: workflow.name,
    };
  });
