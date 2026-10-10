// Potencial de compra e faixa de interesse (spec 0035). Função pura: os pesos
// são o contrato da métrica e a spec os registra.

export type InterestLevel = "LOW" | "MEDIUM" | "HIGH";
export type LeadTemperature = "COLD" | "WARM" | "HOT" | "VERY_HOT";

export interface PotentialSignals {
  temperature: LeadTemperature;
  messagesLast30Days: number;
  inboundLast30Days: number;
  openProposals: number;
  purchasesCount: number;
  interactionLossRate: number;
  /** Agendamento futuro não cancelado (spec 0085). */
  upcomingAppointments?: number;
  /** Tags de interesse no lead: as que a empresa descreveu para a IA aplicar (spec 0085). */
  interestTags?: number;
}

const TEMPERATURE_POINTS: Record<LeadTemperature, number> = { COLD: 5, WARM: 15, HOT: 25, VERY_HOT: 30 };
const MAX_ENGAGEMENT_POINTS = 25;
const MESSAGES_FOR_FULL_ENGAGEMENT = 20;
const OPEN_PROPOSAL_POINTS = 20;
const POINTS_PER_PURCHASE = 5;
const MAX_PURCHASE_POINTS = 15;
const MAX_LOSS_PENALTY = 10;
const UPCOMING_APPOINTMENT_POINTS = 15;
const POINTS_PER_INTEREST_TAG = 5;
const MAX_INTEREST_TAG_POINTS = 10;

export function computePurchasePotential(signals: PotentialSignals): number {
  const engagement = Math.min(
    MAX_ENGAGEMENT_POINTS,
    Math.round((signals.messagesLast30Days / MESSAGES_FOR_FULL_ENGAGEMENT) * MAX_ENGAGEMENT_POINTS),
  );
  // Quem só recebe e não escreve não está engajado, por mais mensagens que haja.
  const engagementPoints = signals.inboundLast30Days > 0 ? engagement : Math.round(engagement / 4);
  const proposalPoints = signals.openProposals > 0 ? OPEN_PROPOSAL_POINTS : 0;
  const purchasePoints = Math.min(MAX_PURCHASE_POINTS, signals.purchasesCount * POINTS_PER_PURCHASE);
  const lossPenalty = Math.round((signals.interactionLossRate / 100) * MAX_LOSS_PENALTY);
  const appointmentPoints = (signals.upcomingAppointments ?? 0) > 0 ? UPCOMING_APPOINTMENT_POINTS : 0;
  const interestTagPoints = Math.min(MAX_INTEREST_TAG_POINTS, (signals.interestTags ?? 0) * POINTS_PER_INTEREST_TAG);
  const score =
    TEMPERATURE_POINTS[signals.temperature] +
    engagementPoints +
    proposalPoints +
    purchasePoints +
    appointmentPoints +
    interestTagPoints -
    lossPenalty;
  return Math.max(0, Math.min(100, score));
}

export function toInterestLevel(purchasePotential: number): InterestLevel {
  if (purchasePotential >= 70) return "HIGH";
  if (purchasePotential >= 40) return "MEDIUM";
  return "LOW";
}

/** Quanto confiar no cálculo: poucos sinais pedem a auditoria por IA. */
export function computeConfidence(params: {
  totalMessages: number;
  inboundLast30Days: number;
  openProposals: number;
  purchasesCount: number;
  upcomingAppointments?: number;
}): number {
  let confidence = 100;
  if (params.totalMessages < 5) confidence -= 40;
  const hasCommercialSignal =
    params.openProposals > 0 || params.purchasesCount > 0 || (params.upcomingAppointments ?? 0) > 0;
  if (!hasCommercialSignal) confidence -= 20;
  if (params.inboundLast30Days === 0) confidence -= 20;
  return Math.max(0, confidence);
}
