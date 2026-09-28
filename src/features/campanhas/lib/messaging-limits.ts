// Limite de disparo da Meta e subida de nível (spec 0040). Puro.
// Doc: developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
// O limite conta CONTATOS ÚNICOS por 24h fora da janela de atendimento e vale
// para o portfólio (todos os números juntos). Conta nova começa em 250.

export interface MessagingLimitLevel {
  tier: string;
  /** null = ilimitado. */
  dailyUniqueContacts: number | null;
  label: string;
}

export const MESSAGING_LIMIT_LEVELS: MessagingLimitLevel[] = [
  { tier: "TIER_50", dailyUniqueContacts: 50, label: "50 por dia" },
  { tier: "TIER_250", dailyUniqueContacts: 250, label: "250 por dia" },
  { tier: "TIER_2K", dailyUniqueContacts: 2_000, label: "2.000 por dia" },
  { tier: "TIER_10K", dailyUniqueContacts: 10_000, label: "10.000 por dia" },
  { tier: "TIER_100K", dailyUniqueContacts: 100_000, label: "100.000 por dia" },
  { tier: "TIER_UNLIMITED", dailyUniqueContacts: null, label: "Ilimitado" },
];

/** Nível da Meta ("TIER_1K" antigo vira 2K, que o substituiu). Sem dado, assume conta nova. */
export function resolveMessagingLimit(tier: string | null | undefined): MessagingLimitLevel {
  const normalized = (tier ?? "").toUpperCase().replace("TIER_1K", "TIER_2K");
  const newAccountLevel = MESSAGING_LIMIT_LEVELS[1];
  return MESSAGING_LIMIT_LEVELS.find((level) => level.tier === normalized) ?? newAccountLevel;
}

export function nextMessagingLimit(current: MessagingLimitLevel): MessagingLimitLevel | null {
  const index = MESSAGING_LIMIT_LEVELS.findIndex((level) => level.tier === current.tier);
  return MESSAGING_LIMIT_LEVELS[index + 1] ?? null;
}

/** O que a Meta exige para subir do nível atual (texto para a tela). */
export function howToReachNextLevel(current: MessagingLimitLevel): string | null {
  const next = nextMessagingLimit(current);
  if (!next) return null;
  if (current.tier === "TIER_50" || current.tier === "TIER_250") {
    return "Verifique a empresa na Meta ou entregue 2.000 mensagens de boa qualidade em 30 dias.";
  }
  const half = current.dailyUniqueContacts ? Math.round(current.dailyUniqueContacts / 2) : 0;
  return `Use pelo menos metade do limite (${half.toLocaleString("pt-BR")} contatos) nos últimos 7 dias com boa qualidade — a Meta sobe sozinha em até 6 h.`;
}

/**
 * Quantos dias a campanha leva no limite atual, e quantos contatos vão por
 * dia. Campanha maior que o limite é dividida em lotes diários.
 */
export function planDailyBatches(recipients: number, level: MessagingLimitLevel): { days: number; perDay: number[] } {
  const total = Math.max(0, Math.round(recipients));
  if (level.dailyUniqueContacts === null || total <= level.dailyUniqueContacts) {
    return { days: total > 0 ? 1 : 0, perDay: total > 0 ? [total] : [] };
  }
  const perDay: number[] = [];
  for (let remaining = total; remaining > 0; remaining -= level.dailyUniqueContacts) {
    perDay.push(Math.min(remaining, level.dailyUniqueContacts));
  }
  return { days: perDay.length, perDay };
}
