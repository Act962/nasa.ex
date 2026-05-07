import prisma from "@/lib/prisma";

export type LeadJourneyEventKind =
  | "form_submit"
  | "message_in"
  | "message_out"
  | "first_response"
  | "appointment_created"
  | "appointment_done"
  | "appointment_no_show"
  | "status_changed"
  | "tag_added"
  | "lead_assigned"
  | "linnker_scan"
  | "ctwa_referral"
  | "utm_landing"
  | "won"
  | "lost";

export interface TrackLeadEventInput {
  leadId: string;
  kind: LeadJourneyEventKind;
  /** userId que fez o evento (atendente, etc). null = sistema/lead. */
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  /** Sobrescreve o timestamp padrão (now). Útil para backfill ou eventos com data conhecida. */
  occurredAt?: Date;
}

/**
 * Cria um evento na timeline do lead. Best-effort: nunca derruba a request principal.
 *
 * Use este helper em todos os hooks de procedure (chat webhook, lead update,
 * appointment update etc) ao invés de Prisma direto, pra centralizar logging.
 */
export async function trackLeadEvent(input: TrackLeadEventInput) {
  try {
    return await prisma.leadJourneyEvent.create({
      data: {
        leadId: input.leadId,
        kind: input.kind,
        actorId: input.actorId ?? null,
        metadata: (input.metadata ?? {}) as object,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  } catch (err) {
    // Logamos mas NÃO repropagamos. Falha no tracking não pode quebrar webhook/UX.
    console.error("[trackLeadEvent] failed", {
      leadId: input.leadId,
      kind: input.kind,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
