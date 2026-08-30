import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { scheduleBroadcastSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";
import { assertBroadcastSendable } from "@/features/campanhas/server/lib/assert-broadcast-sendable";

/**
 * Agenda (ou reagenda) o disparo da campanha (Fase 4). Valida os mesmos
 * pré-requisitos do disparo imediato (template aprovado + destinatários) e
 * grava `scheduledAt` + status `SCHEDULED`. O cron `dispatch-due-broadcasts`
 * pega a campanha quando a hora chega e a coloca em `SENDING`.
 */
export const schedule = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(scheduleBroadcastSchema)
  .handler(async ({ input, context, errors }) => {
    const { org, user } = context;
    const broadcast = await loadBroadcastForOrg(input.broadcastId, org.id);

    await assertBroadcastSendable(broadcast, org.id);

    const scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      throw errors.BAD_REQUEST({
        message: "Escolha uma data e hora futura para o agendamento.",
      });
    }

    const updated = await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: "SCHEDULED", scheduledAt },
      select: { id: true, status: true, scheduledAt: true },
    });

    await logActivity({
      organizationId: org.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      appSlug: "campanhas",
      action: "broadcast.scheduled",
      actionLabel: `Agendou a campanha "${broadcast.name}" para ${scheduledAt.toLocaleString("pt-BR")}`,
      resource: "broadcast",
      resourceId: broadcast.id,
      metadata: {
        templateName: broadcast.templateName,
        scheduledAt: scheduledAt.toISOString(),
      },
    }).catch(() => {});

    return updated;
  });
