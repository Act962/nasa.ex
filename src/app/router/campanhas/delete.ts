import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";

/** Remove uma campanha (cascata: destinatários vão junto). */
export const remove = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const { org, user } = context;
    const broadcast = await loadBroadcastForOrg(input.id, org.id);

    await prisma.broadcast.delete({ where: { id: broadcast.id } });

    await logActivity({
      organizationId: org.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      appSlug: "campanhas",
      action: "broadcast.deleted",
      actionLabel: "Removeu uma campanha",
      resource: "broadcast",
      resourceId: broadcast.id,
      metadata: { name: broadcast.name },
    });

    return { id: broadcast.id };
  });
