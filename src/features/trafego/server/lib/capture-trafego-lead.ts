import "server-only";
import prisma from "@/lib/prisma";
import { normalizeWhatsappPhoneBr } from "@/features/trafego/lib/phone";
import { PLATFORM_SHORT_LABEL } from "@/features/trafego/lib/catalog-labels";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import type {
  TrafegoObjective,
  TrafegoPlatform,
} from "@/generated/prisma/enums";
import {
  computeTopOrder,
  findLeadInTracking,
} from "./ensure-trafego-lead";
import { loadTrafegoSettings } from "./trafego-settings";

/**
 * Lead captado no passo Contato do wizard, antes de existir pagamento
 * (spec 0021). O destino é o funil comercial — tracking próprio, separado do
 * board de operação onde o card nasce no checkout.
 */

export interface TrafegoLeadCaptureInput {
  fullName: string;
  email: string;
  phone: string;
  platform: TrafegoPlatform | null;
  objective: TrafegoObjective | null;
  businessName: string | null;
  segment: string | null;
  adBudgetBrlCents: number | null;
  referralSource: string | null;
}

export interface TrafegoLeadCaptureResult {
  leadId: string;
  trackingId: string;
  /** Coluna onde o card está — o board escuta por coluna para se atualizar. */
  statusId: string;
  /** false quando o card já existia — é o que decide se há notificação (D-7). */
  created: boolean;
}

export async function captureTrafegoLead(
  input: TrafegoLeadCaptureInput,
): Promise<TrafegoLeadCaptureResult | null> {
  const settings = await loadTrafegoSettings();
  const trackingId = settings.captureTrackingId;
  if (!trackingId) return null;

  const statusId = await resolveCaptureStatusId(
    trackingId,
    settings.captureStatusId,
  );
  if (!statusId) {
    console.warn(
      `[trafego/capture] tracking ${trackingId} sem colunas — card não criado.`,
    );
    return null;
  }

  const phone = normalizeWhatsappPhoneBr(input.phone);
  const email = input.email.trim().toLowerCase() || null;
  const description = describeCapture(input);

  const existing = await findLeadInTracking(trackingId, phone, email);

  // Card que já está no funil não volta para a coluna de entrada nem gera
  // popup de novo: quem voltou no wizard não é lead novo (CB-1, CB-7, D-7).
  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        description,
        ...(existing.email ? {} : email ? { email } : {}),
      },
    });
    return {
      leadId: existing.id,
      trackingId,
      statusId: existing.statusId,
      created: false,
    };
  }

  const created = await prisma.lead.create({
    data: {
      trackingId,
      statusId,
      name: input.businessName?.trim() || input.fullName.trim(),
      email,
      phone,
      description,
      source: "OTHER",
      statusEnteredAt: new Date(),
      order: await computeTopOrder(prisma, trackingId, statusId),
    },
    select: { id: true },
  });

  return { leadId: created.id, trackingId, statusId, created: true };
}

/** Coluna configurada; se foi apagada, a primeira do tracking (CB-5, CB-6). */
async function resolveCaptureStatusId(
  trackingId: string,
  configuredStatusId: string | null,
): Promise<string | null> {
  if (configuredStatusId) {
    const configured = await prisma.status.findFirst({
      where: { id: configuredStatusId, trackingId },
      select: { id: true },
    });
    if (configured) return configured.id;
  }

  const firstColumn = await prisma.status.findFirst({
    where: { trackingId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  return firstColumn?.id ?? null;
}

function describeCapture(input: TrafegoLeadCaptureInput): string {
  return [
    "trafeGO · lead do wizard",
    input.platform ? PLATFORM_SHORT_LABEL[input.platform] : null,
    input.segment,
    input.adBudgetBrlCents
      ? `verba pensada ${formatBrlFromCents(input.adBudgetBrlCents)}`
      : null,
    input.referralSource ? `conheceu por ${input.referralSource}` : null,
    `contato ${input.fullName.trim()}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
