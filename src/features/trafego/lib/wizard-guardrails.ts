// Avisos por campo do passo a passo do /trafego (spec 0129, RF-6). Regra fixa, sem IA:
// mesma entrada, mesmo aviso. Só política e verba abaixo do mínimo da Meta barram (D-4).

import type { TrafegoObjective, TrafegoPlatform } from "@/generated/prisma/enums";
import { prescreenAdContent } from "./ad-policies";
import type { AudienceChip } from "./audience";

export type GuardrailField = "message" | "headline" | "objective" | "audience" | "budget" | "creative";
export type GuardrailLevel = "warning" | "blocked";

export interface GuardrailWarning {
  id: string;
  field: GuardrailField;
  level: GuardrailLevel;
  message: string;
  fix: string;
  /** Texto pronto para trocar com um toque (ex.: frase reescrita sem atributo pessoal). */
  rewrite?: string;
}

/** Duração usada pelo /trafego para o pedido (plano padrão de 30 dias). */
export const WIZARD_CAMPAIGN_DAYS = 30;
/** Caracteres que aparecem antes do "...Ver mais" no feed. */
export const VISIBLE_TEXT_CHARS = 125;
const MIN_AGE_RANGE_YEARS = 10;
const LOW_CREATIVE_SCORE = 50;

export interface GuardrailInput {
  platform: TrafegoPlatform | null;
  objective: TrafegoObjective | null;
  message: string;
  headline: string;
  audienceChips: AudienceChip[];
  adBudgetBrlCents: number;
  account: { avgCostPerConversationCents: number | null; minDailyBudgetCents: number | null } | null;
  creative: { score: number; verdict: "ready" | "improve" | "risk" } | null;
  /** Anúncio de WhatsApp precisa de cidade ou região (spec 0130, RF-4). */
  requireLocation?: boolean;
}

const PERSONAL_QUESTION = /\b(?:voc[eê]|vc)\s+(?:tem|t[aá]|est[aá]\s+com|sofre\s+de|possui)\s+([^?.!\n]{2,60})\?/i;
const FOR_WHO_SUFFERS = /\bpara\s+quem\s+(?:sofre\s+de|tem|est[aá]\s+com)\s+([^?.!,\n]{2,60})/i;

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Troca a pergunta sobre a pessoa por uma frase sobre o serviço. Null quando não há o que reescrever. */
export function rewritePersonalAttribute(text: string): string | null {
  const question = text.match(PERSONAL_QUESTION);
  if (question) {
    return text.replace(question[0], `Conheça o tratamento para ${question[1].trim()}.`).replace(/\s{2,}/g, " ").trim();
  }
  const forWho = text.match(FOR_WHO_SUFFERS);
  if (forWho) return text.replace(forWho[0], `tratamento para ${forWho[1].trim()}`).trim();
  return null;
}

function parseAgeRange(value: string): number | null {
  const match = value.match(/(\d{2})\s*a\s*(\d{2})/);
  return match ? Number(match[2]) - Number(match[1]) : null;
}

export function checkWizardGuardrails(input: GuardrailInput): GuardrailWarning[] {
  const warnings: GuardrailWarning[] = [];
  const message = input.message.trim();
  const headline = input.headline.trim();

  if (message) {
    const prescreen = prescreenAdContent({ platform: input.platform, texts: [message, headline] });
    const rewrite = rewritePersonalAttribute(message);
    for (const hit of prescreen.hits) {
      warnings.push({
        id: `policy-${hit.ruleId}`,
        field: "message",
        level: hit.level === "BLOCKED" ? "blocked" : "warning",
        message: `${hit.label}: ${hit.reason}`,
        fix: hit.fix,
        rewrite: hit.ruleId === "personal-attributes" ? (rewrite ?? undefined) : undefined,
      });
    }
    if (rewrite && !warnings.some((warning) => warning.rewrite)) {
      warnings.push({
        id: "personal-question",
        field: "message",
        level: "warning",
        message: "Perguntar sobre a condição de quem vê o anúncio costuma ser reprovado pela Meta.",
        fix: "Fale do serviço, não da pessoa.",
        rewrite,
      });
    }
    const firstParagraph = message.split(/\n/)[0] ?? "";
    if (firstParagraph.length > VISIBLE_TEXT_CHARS) {
      warnings.push({
        id: "text-too-long",
        field: "message",
        level: "warning",
        message: `Só os primeiros ${VISIBLE_TEXT_CHARS} caracteres aparecem antes do "Ver mais".`,
        fix: "Coloque a oferta e o convite para chamar no WhatsApp logo no começo.",
      });
    }
  }

  if (input.platform === "META_ADS" && input.objective && input.objective !== "MESSAGES") {
    warnings.push({
      id: "objective-not-messages",
      field: "objective",
      level: "warning",
      message: "A campanha leva para o WhatsApp, e este objetivo não otimiza para conversa.",
      fix: "Escolha \"Mensagens\": a Meta mostra o anúncio para quem costuma chamar empresas no WhatsApp.",
    });
  }

  if (input.requireLocation && !input.audienceChips.some((chip) => chip.dimension === "location")) {
    warnings.push({
      id: "audience-no-location",
      field: "audience",
      level: "blocked",
      message: "Falta a cidade ou região do público.",
      fix: "Sem região, a verba vai para quem não pode ser atendido. Adicione em Localização.",
    });
  }

  const ageChip = input.audienceChips.find((chip) => chip.dimension === "age");
  const ageRange = ageChip ? parseAgeRange(ageChip.value) : null;
  if (ageRange !== null && ageRange < MIN_AGE_RANGE_YEARS) {
    warnings.push({
      id: "audience-narrow-age",
      field: "audience",
      level: "warning",
      message: "Faixa de idade estreita deixa o público pequeno e o custo por conversa mais alto.",
      fix: "Use uma faixa de pelo menos 10 anos; a Meta encontra sozinha quem responde melhor.",
    });
  }

  const dailyBudgetCents = Math.round(input.adBudgetBrlCents / WIZARD_CAMPAIGN_DAYS);
  const minDaily = input.account?.minDailyBudgetCents ?? null;
  const avgCost = input.account?.avgCostPerConversationCents ?? null;
  if (minDaily && dailyBudgetCents < minDaily) {
    warnings.push({
      id: "budget-below-meta-minimum",
      field: "budget",
      level: "blocked",
      message: `A Meta não aceita menos de ${formatBrl(minDaily)} por dia nesta conta.`,
      fix: `Suba a verba para pelo menos ${formatBrl(minDaily * WIZARD_CAMPAIGN_DAYS)} no mês.`,
    });
  } else if (avgCost && dailyBudgetCents < avgCost) {
    warnings.push({
      id: "budget-below-conversation-cost",
      field: "budget",
      level: "warning",
      message: `Sua conta paga em média ${formatBrl(avgCost)} por conversa, e esta verba dá ${formatBrl(dailyBudgetCents)} por dia: pode não trazer nenhuma conversa em alguns dias.`,
      fix: `Para ao menos uma conversa por dia, use ${formatBrl(avgCost * WIZARD_CAMPAIGN_DAYS)} no mês.`,
    });
  }

  if (input.creative && (input.creative.verdict === "risk" || input.creative.score < LOW_CREATIVE_SCORE)) {
    warnings.push({
      id: "creative-weak",
      field: "creative",
      level: "warning",
      message: `O Astro deu ${input.creative.score} para o criativo.`,
      fix: "Veja os pontos da análise e troque o arquivo antes de pagar, se puder.",
    });
  }

  return warnings;
}
