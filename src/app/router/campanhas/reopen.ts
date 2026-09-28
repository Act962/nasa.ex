import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { reopenBroadcastSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";
import { reopenBroadcast } from "@/features/campanhas/server/lib/reopen-broadcast";

/**
 * Reabre uma campanha que falhou (`FAILED`) para edição/redisparo: volta a
 * `DRAFT` e reseta destinatários falhos para `PENDING`. Só faz sentido em
 * `FAILED` — nos demais status é no-op idempotente que só devolve o estado.
 */
export const reopen = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(reopenBroadcastSchema)
  .handler(async ({ input, context, errors }) => {
    const { org, user } = context;
    const broadcast = await loadBroadcastForOrg(input.broadcastId, org.id);

    if (broadcast.status !== "FAILED") {
      throw errors.BAD_REQUEST({
        message: "Só é possível reabrir uma campanha que falhou.",
      });
    }

    await reopenBroadcast(broadcast.id);

    await logActivity({
      organizationId: org.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      appSlug: "campanhas",
      action: "broadcast.reopened",
      actionLabel: `Reabriu a campanha "${broadcast.name}"`,
      resource: "broadcast",
      resourceId: broadcast.id,
    }).catch(() => {});

    return { id: broadcast.id, status: "DRAFT" as const };
  });
