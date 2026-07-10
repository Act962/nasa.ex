import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { getMessageTemplates } from "@/http/whats-oficial";
import { resolveCampaignMetaCredentials } from "./broadcast-access";

/**
 * Valida que uma campanha está pronta pra ir ao envio: está em rascunho (ou
 * já agendada, permitindo reagendar/disparar agora), tem template escolhido,
 * destinatários pendentes e o template está APROVADO na Meta. Lança
 * `ORPCError BAD_REQUEST` em cada falha; retorna a contagem de pendentes.
 * Compartilhado por `send` (disparo imediato) e `schedule` (agendamento).
 */
interface SendableBroadcast {
  readonly id: string;
  readonly status: string;
  readonly trackingId: string;
  readonly templateName: string | null;
  readonly templateLanguage: string | null;
  readonly templateCategory: string | null;
}

export async function assertBroadcastSendable(
  broadcast: SendableBroadcast,
  organizationId: string,
): Promise<number> {
  if (broadcast.status !== "DRAFT" && broadcast.status !== "SCHEDULED") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Esta campanha já foi disparada ou não está em rascunho.",
    });
  }
  if (
    !broadcast.templateName ||
    !broadcast.templateLanguage ||
    !broadcast.templateCategory
  ) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Escolha um template antes de disparar.",
    });
  }

  const pendingCount = await prisma.broadcastRecipient.count({
    where: { broadcastId: broadcast.id, status: "PENDING" },
  });
  if (pendingCount === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Nenhum destinatário pendente para disparar.",
    });
  }

  const credentials = await resolveCampaignMetaCredentials(
    broadcast.trackingId,
    organizationId,
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
    throw new ORPCError("BAD_REQUEST", {
      message:
        "O template selecionado não está aprovado pela Meta. Aguarde a aprovação ou escolha outro.",
    });
  }

  return pendingCount;
}
