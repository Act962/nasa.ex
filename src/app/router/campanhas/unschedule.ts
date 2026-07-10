import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { unscheduleBroadcastSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";

/**
 * Cancela o agendamento de uma campanha `SCHEDULED`, voltando-a a `DRAFT` e
 * limpando `scheduledAt`. Não descarta template nem destinatários — só desfaz o
 * agendamento (Fase 4).
 */
export const unschedule = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(unscheduleBroadcastSchema)
  .handler(async ({ input, context, errors }) => {
    const { org, user } = context;
    const broadcast = await loadBroadcastForOrg(input.broadcastId, org.id);

    if (broadcast.status !== "SCHEDULED") {
      throw errors.BAD_REQUEST({
        message: "Só é possível cancelar o agendamento de uma campanha agendada.",
      });
    }

    const updated = await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: "DRAFT", scheduledAt: null },
      select: { id: true, status: true },
    });

    await logActivity({
      organizationId: org.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      appSlug: "campanhas",
      action: "broadcast.unscheduled",
      actionLabel: `Cancelou o agendamento da campanha "${broadcast.name}"`,
      resource: "broadcast",
      resourceId: broadcast.id,
    }).catch(() => {});

    return updated;
  });
