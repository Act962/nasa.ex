// Orientação do Astro para o passo a passo do /trafego (spec 0129, RF-4). Tipos e regras puras:
// o mesmo formato vale para a resposta do modelo, para o rascunho do pedido e para a tela.

import { z } from "zod";
import { AUDIENCE_DIMENSIONS, type AudienceChip } from "../audience";
import { WIZARD_CAMPAIGN_DAYS } from "../wizard-guardrails";

const META_OBJECTIVES = ["LEADS", "MESSAGES", "SALES", "TRAFFIC", "ENGAGEMENT", "AWARENESS"] as const;
const META_CAMPAIGN_TYPES = ["PROSPECCAO", "REMARKETING", "VENDA_DIRETA", "RECONHECIMENTO", "RELACIONAMENTO"] as const;

function optionsOf(dimension: AudienceChip["dimension"]): [string, ...string[]] {
  return AUDIENCE_DIMENSIONS.find((spec) => spec.id === dimension)?.options as [string, ...string[]];
}

export const creativeGuidanceSchema = z.object({
  objective: z.object({ value: z.enum(META_OBJECTIVES), reason: z.string().max(200) }),
  campaignType: z.object({ value: z.enum(META_CAMPAIGN_TYPES), reason: z.string().max(200) }),
  audience: z.object({
    gender: z.enum(optionsOf("gender")),
    age: z.enum(optionsOf("age")),
    interests: z.array(z.enum(optionsOf("interest"))).max(3),
    reason: z.string().max(200),
  }),
});

/** Textos do botão "Gere com IA" (spec 0130, RF-1, RF-3): duas opções e a mensagem inicial do WhatsApp. */
export const adCopySuggestionSchema = z.object({
  options: z.array(z.object({ message: z.string().max(600), headline: z.string().max(60) })).min(1).max(2),
  initialMessage: z.string().max(160),
});

export type AdCopySuggestion = z.infer<typeof adCopySuggestionSchema>;

export type CreativeGuidance = z.infer<typeof creativeGuidanceSchema>;

export function guidanceAudienceChips(guidance: CreativeGuidance): AudienceChip[] {
  return [
    { dimension: "gender" as const, value: guidance.audience.gender },
    { dimension: "age" as const, value: guidance.audience.age },
    ...guidance.audience.interests.map((interest) => ({ dimension: "interest" as const, value: interest })),
  ];
}

export interface BudgetSuggestion {
  minMonthlyCents: number;
  recommendedMonthlyCents: number;
  reason: string;
}

const CONVERSATIONS_PER_DAY_TARGET = 3;

/** Verba pelo custo por conversa da conta (RF-4): mínima = 1 conversa/dia, recomendada = 3. */
export function suggestBudget(params: {
  avgCostPerConversationCents: number | null;
  minDailyBudgetCents: number | null;
}): BudgetSuggestion | null {
  const avgCost = params.avgCostPerConversationCents;
  if (!avgCost) return null;
  const minDaily = Math.max(params.minDailyBudgetCents ?? 0, avgCost);
  const recommendedDaily = Math.max(minDaily, avgCost * CONVERSATIONS_PER_DAY_TARGET);
  const roundToTen = (cents: number) => Math.ceil(cents / 1_000) * 1_000;
  return {
    minMonthlyCents: roundToTen(minDaily * WIZARD_CAMPAIGN_DAYS),
    recommendedMonthlyCents: roundToTen(recommendedDaily * WIZARD_CAMPAIGN_DAYS),
    reason: `Sua conta paga em média ${(avgCost / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por conversa: a recomendada dá cerca de ${CONVERSATIONS_PER_DAY_TARGET} conversas por dia.`,
  };
}
