import "server-only";
import prisma from "@/lib/prisma";
import {
  NOTIF_TYPES,
  createNotification,
} from "@/features/admin/lib/notification-service";
import {
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import type { TrafegoLeadCaptureInput } from "./capture-trafego-lead";

/**
 * Popup para a equipe NASA quando um lead novo cai do wizard (spec 0021).
 *
 * Um registro por admin, não um broadcast: o `AlertProvider` escuta
 * `private-user-{id}`, e o ack do popup é por pessoa (D-5).
 */
export async function notifyAdminsOfCapturedLead(params: {
  leadId: string;
  trackingId: string;
  capture: TrafegoLeadCaptureInput;
}): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { isSystemAdmin: true },
    select: { id: true },
  });
  if (admins.length === 0) return;

  const { capture } = params;
  const { title, body } = buildLeadMessage(capture);

  const actionUrl = `/tracking/${params.trackingId}?leadId=${params.leadId}`;

  // Sequencial de propósito: a equipe NASA é pequena e o evento é raro. Um
  // Promise.all abriria N conexões só para ganhar milissegundos.
  for (const admin of admins) {
    try {
      await createNotification({
        userId: admin.id,
        type: NOTIF_TYPES.TRAFEGO_LEAD_CAPTURED,
        title,
        body,
        appKey: "trafego",
        actionUrl,
        severity: "warning",
        displaySurface: "popup",
        requiresAck: true,
        metadata: {
          leadId: params.leadId,
          trackingId: params.trackingId,
          phone: capture.phone,
          email: capture.email,
        },
      });
    } catch (error) {
      // Notificar é efeito colateral: a captura do lead já está gravada e não
      // pode ser invalidada por um admin que falhou (CB-10).
      console.error("[trafego/capture] notificação falhou:", error);
    }
  }
}

/**
 * Texto da notificação de lead novo.
 *
 * Uma linha por assunto, e não tudo separado por "·": num push cabem 2–3 linhas,
 * e a versão anterior empilhava nome, telefone, e-mail, canal, objetivo e verba
 * num parágrafo único que ninguém lia. O popup renderiza com `whitespace-pre-wrap`
 * e o Chrome respeita a quebra de linha, então ela vale nos dois canais.
 *
 * A identidade fica só no título: quando o nome do negócio e o do contato são
 * iguais — caso comum de autônomo — repetir no corpo era ruído.
 */
function buildLeadMessage(capture: TrafegoLeadCaptureInput): {
  title: string;
  body: string;
} {
  const businessName = capture.businessName?.trim() || null;
  const contactName = capture.fullName.trim();
  const headline = businessName ?? contactName;

  const campaign = [
    capture.platform ? PLATFORM_SHORT_LABEL[capture.platform] : null,
    capture.objective ? OBJECTIVE_LABEL[capture.objective] : null,
    capture.adBudgetBrlCents
      ? `verba ${formatBrlFromCents(capture.adBudgetBrlCents)}`
      : null,
  ].filter(Boolean);

  const lines = [
    // Só nomeia o contato quando ele não é o próprio nome que já está no título.
    businessName && contactName !== businessName ? `Contato: ${contactName}` : null,
    [capture.phone.trim(), capture.email.trim()].filter(Boolean).join("  ·  "),
    campaign.length > 0 ? campaign.join("  ·  ") : null,
  ].filter(Boolean);

  return {
    title: `Lead novo do trafeGO — ${headline}`,
    body: lines.join("\n"),
  };
}
