// Motor de recomendação do Simulador (puro). Traduz o uso descrito em linguagem
// de negócio (nº de usuários, exemplos de mensagem, tipo de tarefa) em:
//  - estimativa de tokens (o usuário não informa tokens),
//  - modelo de IA recomendado (o usuário não escolhe modelo),
//  - dimensionamento de infra (servidor/banco/storage) e do WhatsApp.
//
// Heurísticas transparentes e ajustáveis — a ideia é orientar, não cravar.

import { MODEL_CATALOG, modelsForTier, blendedCostPer1k, type AstroTier } from "@/features/ia/lib/router/model-catalog";

export type TaskComplexity = "SIMPLES" | "PADRAO" | "AVANCADO";
export type ResponseSize = "CURTA" | "MEDIA" | "LONGA";

export interface MessageSample {
  text: string;
  perUserPerDay: number;
}

export interface UsageProfile {
  userCount: number;
  daysPerMonth: number;
  samples: MessageSample[];
  complexity: TaskComplexity;
  responseSize: ResponseSize;
}

// ~4 caracteres por token é a aproximação usual para PT-BR.
const CHARS_PER_TOKEN = 4;
// Overhead de system prompt/contexto somado a cada mensagem.
const SYSTEM_OVERHEAD_TOKENS = 400;

const RESPONSE_TOKENS: Record<ResponseSize, number> = {
  CURTA: 150,
  MEDIA: 450,
  LONGA: 1100,
};

const COMPLEXITY_TIER: Record<TaskComplexity, AstroTier> = {
  SIMPLES: "FAST",
  PADRAO: "SMART",
  AVANCADO: "DEEP",
};

export const COMPLEXITY_LABEL: Record<TaskComplexity, string> = {
  SIMPLES: "Simples — classificação, extração, respostas diretas",
  PADRAO: "Padrão — perguntas objetivas, consultas, atendimento",
  AVANCADO: "Avançado — análise, raciocínio, textos longos",
};

export const RESPONSE_LABEL: Record<ResponseSize, string> = {
  CURTA: "Curta (uma frase / um dado)",
  MEDIA: "Média (um parágrafo)",
  LONGA: "Longa (vários parágrafos)",
};

export const TIER_LABEL: Record<AstroTier, string> = {
  FAST: "Econômico",
  SMART: "Equilibrado",
  DEEP: "Avançado",
};

// Explicação em linguagem simples de cada plano/termo, por `code` do catálogo.
export const PLAN_HINTS: Record<string, string> = {
  "vps-basico": "servidor pequeno, até ~200 usuários",
  "vps-intermediario": "servidor médio, mais usuários e tráfego",
  "neon-launch": "banco inicial, projetos pequenos",
  "neon-scale": "banco robusto, mais dados e conexões",
  "neon-compute": "processamento do banco cobrado por hora de uso",
  "cloudflare-r2-storage": "armazenamento de arquivos (fotos, PDFs), por GB/mês",
  "cloudflare-workers-paid": "hospedagem serverless",
  "dev-hora": "desenvolvedor por hora",
  "designer-hora": "designer por hora",
  "pm-hora": "gerente de projeto por hora",
  "suporte-mes": "suporte mensalista",
};

export function planHint(code: string | null | undefined): string {
  return code ? PLAN_HINTS[code] ?? "" : "";
}

// Link para a página pública de onde o preço foi extraído, por provedor/categoria.
export function sourceUrlFor(item: {
  provider?: string | null;
  category?: string | null;
}): string | null {
  const provider = (item.provider ?? "").toLowerCase();
  if (item.category === "WHATSAPP_CONVERSATION" || provider.includes("meta")) {
    return "https://whatsappbusiness.com/pt-br/products/platform-pricing/?country=Brasil&currency=Real%20brasileiro%20(BRL)";
  }
  if (provider.includes("openai")) return "https://openai.com/api/pricing/";
  if (provider.includes("anthropic")) return "https://www.anthropic.com/pricing";
  if (provider.includes("google")) return "https://ai.google.dev/pricing";
  if (provider.includes("cloudflare")) return "https://www.cloudflare.com/plans/";
  if (provider.includes("neon")) return "https://neon.com/pricing";
  return null;
}

export function charsToTokens(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

export interface UsageEstimate {
  messagesPerUserPerDay: number;
  monthlyMessages: number;
  inputTokensPerUser: number;
  outputTokensPerUser: number;
  avgInputTokensPerMessage: number;
  avgOutputTokensPerMessage: number;
}

// Estima tokens/mês por usuário a partir dos exemplos de mensagem.
export function estimateUsage(profile: UsageProfile): UsageEstimate {
  const messagesPerUserPerDay = profile.samples.reduce(
    (total, sample) => total + Math.max(sample.perUserPerDay, 0),
    0,
  );

  const weightedInputTokens = profile.samples.reduce(
    (total, sample) => total + charsToTokens(sample.text.length) * Math.max(sample.perUserPerDay, 0),
    0,
  );
  const avgPromptTokens =
    messagesPerUserPerDay > 0 ? weightedInputTokens / messagesPerUserPerDay : 0;
  const avgInputTokensPerMessage = Math.round(avgPromptTokens + SYSTEM_OVERHEAD_TOKENS);
  const avgOutputTokensPerMessage = RESPONSE_TOKENS[profile.responseSize];

  const inputTokensPerUser = Math.round(
    avgInputTokensPerMessage * messagesPerUserPerDay * profile.daysPerMonth,
  );
  const outputTokensPerUser = Math.round(
    avgOutputTokensPerMessage * messagesPerUserPerDay * profile.daysPerMonth,
  );

  return {
    messagesPerUserPerDay,
    monthlyMessages: Math.round(messagesPerUserPerDay * profile.daysPerMonth * profile.userCount),
    inputTokensPerUser,
    outputTokensPerUser,
    avgInputTokensPerMessage,
    avgOutputTokensPerMessage,
  };
}

export interface ModelRecommendation {
  modelId: string;
  tier: AstroTier;
  tierLabel: string;
  reason: string;
}

// Recomenda o modelo de melhor custo dentro do nível adequado à complexidade.
export function recommendModel(complexity: TaskComplexity): ModelRecommendation {
  const tier = COMPLEXITY_TIER[complexity];
  const candidates = modelsForTier(tier);
  const cheapest = [...candidates].sort(
    (left, right) => blendedCostPer1k(left.id) - blendedCostPer1k(right.id),
  )[0];
  const fallback = cheapest ?? MODEL_CATALOG[0];
  return {
    modelId: fallback.id,
    tier,
    tierLabel: TIER_LABEL[tier],
    reason: `Nível ${TIER_LABEL[tier].toLowerCase()} atende "${COMPLEXITY_LABEL[complexity].split(" — ")[1] ?? ""}" com o melhor custo.`,
  };
}

export type WhatsappUsageType = "RECEPTIVO" | "ATIVO";

export interface WhatsappRecommendation {
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  conversationsPerUser: number;
  reason: string;
}

// Uma sessão WhatsApp dura 24h, então mensagens do mesmo usuário no dia contam
// como ~1 conversa. Receptivo (cliente inicia) → Utilidade; Ativo (empresa
// inicia) → Marketing.
export function recommendWhatsapp(
  type: WhatsappUsageType,
  daysPerMonth: number,
  messagesPerUserPerDay: number,
): WhatsappRecommendation {
  const conversationsPerUser = messagesPerUserPerDay > 0 ? daysPerMonth : 0;
  return {
    category: type === "RECEPTIVO" ? "UTILITY" : "MARKETING",
    conversationsPerUser,
    reason:
      type === "RECEPTIVO"
        ? "Cliente inicia o contato → conversas de Utilidade."
        : "Empresa inicia o contato → conversas de Marketing.",
  };
}

export interface InfraPick {
  category: "INFRA_SERVER" | "DATABASE" | "STORAGE";
  code: string;
  quantity: number;
  reason: string;
}

// Dimensiona servidor, banco e storage por faixa de usuários. `code` casa com o
// catálogo semeado (vps-basico/intermediario, neon-launch/scale, cloudflare-r2).
export function recommendInfra(userCount: number, storageMbPerUser = 50): InfraPick[] {
  const server: InfraPick =
    userCount < 200
      ? { category: "INFRA_SERVER", code: "vps-basico", quantity: 1, reason: "Até 200 usuários: VPS básico." }
      : { category: "INFRA_SERVER", code: "vps-intermediario", quantity: 1, reason: "Acima de 200 usuários: VPS intermediário." };

  const database: InfraPick =
    userCount < 300
      ? { category: "DATABASE", code: "neon-launch", quantity: 1, reason: "Base pequena/média: Neon Launch." }
      : { category: "DATABASE", code: "neon-scale", quantity: 1, reason: "Base maior: Neon Scale." };

  const storageGb = Math.max(1, Math.ceil((userCount * storageMbPerUser) / 1024));
  const storage: InfraPick = {
    category: "STORAGE",
    code: "cloudflare-r2-storage",
    quantity: storageGb,
    reason: `${storageMbPerUser} MB por usuário → ~${storageGb} GB no R2.`,
  };

  return [server, database, storage];
}
