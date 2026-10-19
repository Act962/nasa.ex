import "server-only";
import prisma from "@/lib/prisma";
import { trackLeadEvent, type TrackLeadEventInput } from "@/lib/lead-journey/track";

// Origem real do lead (spec 0114, RF-1): gravada uma vez, na criação, como evento `lead_origin` da Jornada.
// Só da equipe (fora da página pública do lead). Melhor esforço: nunca derruba a criação do lead.

export type LeadOrigin =
  | "WHATSAPP"
  | "LINNKER"
  | "PAGES"
  | "TRAFEGO"
  | "META_ADS"
  | "FORM"
  | "AGENDA"
  | "SITE_CHAT"
  | "IN_CHAT"
  | "INSTAGRAM_DIRECT"
  | "INSTAGRAM_COMMENT"
  | "FACEBOOK"
  | "CATALOG"
  | "CAMPANHA"
  | "API"
  | "MANUAL"
  | "IMPORT";

/** Como a origem foi descoberta: entrada conhecida, código na mensagem, horário do clique ou anúncio. */
export type LeadOriginMatch = "entry" | "code" | "click_time" | "meta_ad";

export interface LeadOriginDetails {
  origin: LeadOrigin;
  /** Nome da página, formulário, campanha ou anúncio. */
  sourceName?: string | null;
  sourceId?: string | null;
  /** Canal da conversa ("WHATSAPP", "INSTAGRAM"...), quando é diferente da origem. */
  channel?: string | null;
  matchedBy: LeadOriginMatch;
  confidence: "certain" | "probable";
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; content?: string | null; term?: string | null };
  /** Texto livre de quem preencheu ("conheceu por" do trafeGO). */
  note?: string | null;
}

/** Evento pronto para quem junta os eventos e grava depois da transação (formulário). */
export function buildLeadOriginEvent(leadId: string, details: LeadOriginDetails): TrackLeadEventInput {
  const utm = details.utm && Object.values(details.utm).some(Boolean) ? details.utm : undefined;
  return {
    leadId,
    kind: "lead_origin",
    metadata: {
      origin: details.origin,
      sourceName: details.sourceName ?? null,
      sourceId: details.sourceId ?? null,
      channel: details.channel ?? null,
      matchedBy: details.matchedBy,
      confidence: details.confidence,
      ...(utm ? { utm } : {}),
      ...(details.note ? { note: details.note } : {}),
    },
  };
}

export async function recordLeadOrigin(leadId: string, details: LeadOriginDetails): Promise<void> {
  try {
    const existing = await prisma.leadJourneyEvent.findFirst({
      where: { leadId, kind: "lead_origin" },
      select: { id: true },
    });
    if (existing) return;
    await trackLeadEvent(buildLeadOriginEvent(leadId, details));
  } catch (error) {
    console.warn("[lead-origin] gravar origem falhou", error);
  }
}

/** Origem a partir do que a entrada já sabe (formulário, agenda, API...). As UTMs vêm do próprio lead. */
export async function recordLeadOriginFromLead(
  leadId: string,
  details: Omit<LeadOriginDetails, "utm" | "matchedBy" | "confidence">,
): Promise<void> {
  const lead = await prisma.lead
    .findUnique({
      where: { id: leadId },
      select: { utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true, utmTerm: true },
    })
    .catch(() => null);
  await recordLeadOrigin(leadId, {
    ...details,
    matchedBy: "entry",
    confidence: "certain",
    utm: lead
      ? {
          source: lead.utmSource,
          medium: lead.utmMedium,
          campaign: lead.utmCampaign,
          content: lead.utmContent,
          term: lead.utmTerm,
        }
      : undefined,
  });
}
