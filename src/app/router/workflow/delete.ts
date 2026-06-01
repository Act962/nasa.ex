import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteWorkflow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: input.id },
      include: {
        tracking: { select: { name: true, organizationId: true } },
      },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({
        message: "Workflow não encontrado",
      });
    }

    await prisma.workflow.delete({
      where: { id: input.id },
    });

    if (workflow.tracking) {
      await logActivity({
        organizationId: workflow.tracking.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        action: "workflow.deleted",
        actionLabel: `Deletou a automação "${workflow.name}" no tracking "${workflow.tracking.name}"`,
        resource: workflow.name,
        resourceId: workflow.id,
        metadata: {
          trackingName: workflow.tracking.name,
          wasActive: workflow.isActive,
          agentMode: workflow.agentMode,
        },
      });
    }

    return workflow;
  });
