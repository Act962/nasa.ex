import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteStatus = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      statusId: z.string(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const status = await prisma.status.findUnique({
      where: {
        id: input.statusId,
      },
      select: {
        name: true,
        trackingId: true,
        tracking: {
          select: { name: true, organizationId: true },
        },
        leads: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!status) {
      throw errors.NOT_FOUND({
        message: "Status não encontrado",
      });
    }

    if (status.leads.length > 0) {
      throw errors.BAD_REQUEST({
        message: "Não é possível deletar uma coluna que possui leads",
      });
    }

    const deleted = await prisma.status.delete({
      where: {
        id: input.statusId,
      },
    });

    if (status.tracking?.organizationId) {
      await logActivity({
        organizationId: status.tracking.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        subAppSlug: "tracking-pipeline",
        featureKey: "status.deleted",
        action: "status.deleted",
        actionLabel: `Excluiu o status "${status.name}" do tracking "${status.tracking.name}"`,
        resource: status.name,
        resourceId: input.statusId,
        metadata: {
          trackingId: status.trackingId,
          trackingName: status.tracking.name,
        },
      });
    }

    return deleted;
  });
