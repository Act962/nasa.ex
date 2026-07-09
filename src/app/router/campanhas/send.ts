import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { getMessageTemplates } from "@/http/whats-oficial";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { sendBroadcastSchema } from "@/features/campanhas/schema/broadcast-schemas";
import {
  loadBroadcastForOrg,
  resolveCampaignMetaCredentials,
} from "@/features/campanhas/server/lib/broadcast-access";

/**
 * Dispara a campanha: valida rascunho + template aprovado + destinatários
 * pendentes, marca `SENDING` e delega o envio em massa ao handler Inngest
 * `campanhas/broadcast.send` (throttle + persistência de wamid). A procedure
 * não envia nada — só orquestra.
 */
export const send = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(sendBroadcastSchema)
  .handler(async ({ input, context, errors }) => {
    const { org, user } = context;
    const broadcast = await loadBroadcastForOrg(input.broadcastId, org.id);

    if (broadcast.status !== "DRAFT") {
      throw errors.BAD_REQUEST({
        message: "Esta campanha já foi disparada ou não está em rascunho.",
      });
    }
    if (!broadcast.templateName || !broadcast.templateLanguage || !broadcast.templateCategory) {
      throw errors.BAD_REQUEST({
        message: "Escolha um template antes de disparar.",
      });
    }

    const pendingCount = await prisma.broadcastRecipient.count({
      where: { broadcastId: broadcast.id, status: "PENDING" },
    });
    if (pendingCount === 0) {
      throw errors.BAD_REQUEST({
        message: "Nenhum destinatário pendente para disparar.",
      });
    }

    const credentials = await resolveCampaignMetaCredentials(
      broadcast.trackingId,
      org.id,
    );
    const { data: templates } = await getMessageTemplates(
      credentials.accessToken,
      credentials.wabaId,
    );
    const approved = templates.find(
      (template) =>
        template.name === broadcast.templateName &&
        template.language === broadcast.templateLanguage &&
        template.status === "APPROVED",
    );
    if (!approved) {
      throw errors.BAD_REQUEST({
        message:
          "O template selecionado não está aprovado pela Meta. Aguarde a aprovação ou escolha outro.",
      });
    }

    const updated = await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: "SENDING", startedAt: new Date() },
      select: { id: true, status: true, startedAt: true },
    });

    await inngest.send({
      name: "campanhas/broadcast.send",
      data: { broadcastId: broadcast.id, organizationId: org.id },
    });

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

    return updated;
  });
