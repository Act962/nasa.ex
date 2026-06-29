/**
 * Helpers de classificação de leads "para resgate".
 *
 * Lê os timestamps de jornada do `Lead` e responde quais buckets se aplicam:
 *   - noResponse: lead mandou inbound mas atendente nunca respondeu
 *     dentro do SLA (ou já passou do SLA sem resposta)
 *   - unassigned: `responsibleId = null`
 *   - stuckInStage: `lastStatusChangeAt` mais antigo que `stuckDays` dias
 *   - noShow: tem appointment NO_SHOW recente sem follow-up posterior
 *
 * Os critérios são configuráveis por organização via `slaHours` e `stuckDays`.
 */

export interface RescueConfig {
  /** Horas máximas entre o inbound do lead e a resposta do atendente. Default: 24h. */
  slaHours: number;
  /** Dias máximos parado em uma mesma etapa. Default: 7d. */
  stuckDays: number;
}

export const DEFAULT_RESCUE_CONFIG: RescueConfig = {
  slaHours: 24,
  stuckDays: 7,
};

export interface LeadRescueSnapshot {
  id: string;
  responsibleId: string | null;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  firstResponseAt: Date | null;
  lastStatusChangeAt: Date | null;
  createdAt: Date;
}

/** Retorna true se o lead estourou o SLA de primeira resposta. */
export function isNoResponse(
  lead: LeadRescueSnapshot,
  config: RescueConfig = DEFAULT_RESCUE_CONFIG,
  now: Date = new Date(),
): boolean {
  // Sem inbound, não há SLA a estourar
  if (!lead.lastInboundAt) return false;
  // Atendente já respondeu depois do inbound — SLA cumprido
  if (
    lead.lastOutboundAt &&
    lead.lastOutboundAt.getTime() > lead.lastInboundAt.getTime()
  ) {
    return false;
  }
  const elapsedHours =
    (now.getTime() - lead.lastInboundAt.getTime()) / (1000 * 60 * 60);
  return elapsedHours > config.slaHours;
}

export function isStuckInStage(
  lead: LeadRescueSnapshot,
  config: RescueConfig = DEFAULT_RESCUE_CONFIG,
  now: Date = new Date(),
): boolean {
  // Sem mudança de status desde a criação? Usa createdAt como referência
  const ref = lead.lastStatusChangeAt ?? lead.createdAt;
  const elapsedDays = (now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24);
  return elapsedDays > config.stuckDays;
}

export function isUnassigned(lead: LeadRescueSnapshot): boolean {
  return !lead.responsibleId;
}

/** Devolve todos os buckets aplicáveis ao lead. Pode estar em vários ao mesmo tempo. */
export function computeRescueBuckets(
  lead: LeadRescueSnapshot,
  config: RescueConfig = DEFAULT_RESCUE_CONFIG,
  now: Date = new Date(),
): Array<"noResponse" | "unassigned" | "stuckInStage"> {
  const buckets: Array<"noResponse" | "unassigned" | "stuckInStage"> = [];
  if (isNoResponse(lead, config, now)) buckets.push("noResponse");
  if (isUnassigned(lead)) buckets.push("unassigned");
  if (isStuckInStage(lead, config, now)) buckets.push("stuckInStage");
  return buckets;
}

/**
 * Calcula horas restantes até o SLA expirar (negativo = já estourou).
 * Útil para UI que mostra urgência.
 */
export function hoursUntilSlaBreach(
  lead: LeadRescueSnapshot,
  config: RescueConfig = DEFAULT_RESCUE_CONFIG,
  now: Date = new Date(),
): number | null {
  if (!lead.lastInboundAt) return null;
  if (
    lead.lastOutboundAt &&
    lead.lastOutboundAt.getTime() > lead.lastInboundAt.getTime()
  ) {
    return null;
  }
  const breachAt = lead.lastInboundAt.getTime() + config.slaHours * 60 * 60 * 1000;
  return (breachAt - now.getTime()) / (1000 * 60 * 60);
}
