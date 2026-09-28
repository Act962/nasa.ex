import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { sendBroadcastSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";
import { assertBroadcastSendable } from "@/features/campanhas/server/lib/assert-broadcast-sendable";
import { beginBroadcastDispatch } from "@/features/campanhas/server/lib/begin-broadcast-dispatch";

/**
 * Dispara a campanha AGORA: valida rascunho/agendada + template aprovado +
 * destinatários pendentes, reivindica a campanha pra `SENDING` e delega o envio
 * em massa ao handler Inngest `campanhas/broadcast.send`. Aceita `DRAFT` ou
 * `SCHEDULED` (o "Disparar agora" antecipa um agendamento). A procedure não
 * envia nada — só orquestra.
 */
export const send = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(sendBroadcastSchema)
  .handler(async ({ input, context, errors }) => {
    const { org, user } = context;
    const broadcast = await loadBroadcastForOrg(input.broadcastId, org.id);

    const pendingCount = await assertBroadcastSendable(broadcast, org.id);

    const claimed = await beginBroadcastDispatch({
      broadcastId: broadcast.id,
      organizationId: org.id,
      fromStatuses: ["DRAFT", "SCHEDULED"],
    });
    if (!claimed) {
      throw errors.BAD_REQUEST({
        message: "Esta campanha já está sendo disparada.",
      });
    }

    await logActivity({
      organizationId: org.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      appSlug: "campanhas",
      action: "broadcast.sent",
      actionLabel: `Disparou a campanha "${broadcast.name}" (${pendingCount} destinatários)`,
      resource: "broadcast",
      resourceId: broadcast.id,
      metadata: {
        templateName: broadcast.templateName,
        recipients: pendingCount,
      },
    }).catch(() => {});

    return { id: broadcast.id, status: "SENDING" as const };
  });
