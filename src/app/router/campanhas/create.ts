import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { createBroadcastSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { assertMetaCloudTracking } from "@/features/campanhas/server/lib/broadcast-access";

/** Cria uma campanha DRAFT vinculada a um número Oficial (`META_CLOUD`). */
export const create = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(createBroadcastSchema)
  .handler(async ({ input, context }) => {
    const { org, user } = context;

    await assertMetaCloudTracking(input.trackingId, org.id);

    const broadcast = await prisma.broadcast.create({
      data: {
        name: input.name,
        organizationId: org.id,
        trackingId: input.trackingId,
        createdById: user.id,
      },
      select: { id: true, name: true, status: true, createdAt: true },
    });

    await logActivity({
      organizationId: org.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      appSlug: "campanhas",
      action: "broadcast.created",
      actionLabel: "Criou uma campanha",
      resource: "broadcast",
      resourceId: broadcast.id,
      metadata: { name: broadcast.name },
    });

    return broadcast;
  });
