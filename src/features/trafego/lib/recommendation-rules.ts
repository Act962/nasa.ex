import type { TrafegoObjective, TrafegoPlatform } from "@/generated/prisma/enums";

/**
 * Regras duras da recomendação — o que não é opinião.
 *
 * Ficam em código, não no modelo: verba mínima por dia e formato por objetivo
 * são aritmética e política de plataforma. O modelo escreve o texto em cima
 * disso; deixá-lo inventar número daria conselho diferente a cada refresh.
 */

/** Abaixo disso a campanha não sai da fase de aprendizado e queima verba. */
export const MIN_DAILY_BRL_CENTS: Record<TrafegoPlatform, number> = {
  META_ADS: 1_500, // R$ 15/dia
  GOOGLE_ADS: 2_000, // R$ 20/dia — CPC de busca é mais caro
  WHATSAPP_OFICIAL: 1_000, // R$ 10/dia — custo por conversa iniciada
};

/** Piso confortável: abaixo, o resultado oscila demais para otimizar. */
export const COMFORT_DAILY_BRL_CENTS: Record<TrafegoPlatform, number> = {
  META_ADS: 3_000,
  GOOGLE_ADS: 5_000,
  WHATSAPP_OFICIAL: 2_000,
};

export type CreativeFormat = "video" | "static" | "both" | "text";

interface FormatRule {
  format: CreativeFormat;
  reason: string;
}

/**
 * Formato por objetivo. Vídeo ganha em alcance e reconhecimento porque o leilão
 * do Meta entrega mais impressão por real em vídeo curto; estático converte
 * melhor quando a pessoa já conhece a marca e só precisa da oferta.
 */
const FORMAT_BY_OBJECTIVE: Partial<Record<TrafegoObjective, FormatRule>> = {
  AWARENESS: { format: "video", reason: "reconhecimento é onde vídeo curto entrega mais alcance por real" },
  ENGAGEMENT: { format: "video", reason: "vídeo gera mais comentário e compartilhamento que imagem" },
  TRAFFIC: { format: "both", reason: "vale testar os dois: vídeo para atrair, estático para a oferta" },
  LEADS: { format: "both", reason: "vídeo explica o serviço, estático fecha com a oferta" },
  MESSAGES: { format: "static", reason: "quem já vai chamar no WhatsApp responde melhor a uma oferta direta" },
  SALES: { format: "static", reason: "venda direta pede produto, preço e condição bem visíveis" },
  SEARCH: { format: "text", reason: "na busca do Google quem vende é o texto do anúncio, não a imagem" },
  BROADCAST: { format: "text", reason: "no disparo o que importa é a mensagem e o momento do envio" },
};

export interface BudgetAssessment {
  dailyBrlCents: number;
  level: "below_minimum" | "tight" | "comfortable";
  minDailyBrlCents: number;
}

export function assessBudget(params: {
  platform: TrafegoPlatform;
  adBudgetBrlCents: number;
  durationDays: number;
}): BudgetAssessment {
  const days = Math.max(1, params.durationDays);
  const dailyBrlCents = Math.round(params.adBudgetBrlCents / days);
  const minimum = MIN_DAILY_BRL_CENTS[params.platform];
  const comfort = COMFORT_DAILY_BRL_CENTS[params.platform];

  return {
    dailyBrlCents,
    minDailyBrlCents: minimum,
    level:
      dailyBrlCents < minimum
        ? "below_minimum"
        : dailyBrlCents < comfort
          ? "tight"
          : "comfortable",
  };
}

export function recommendFormat(objective: TrafegoObjective): FormatRule {
  return (
    FORMAT_BY_OBJECTIVE[objective] ?? {
      format: "both",
      reason: "vale testar vídeo e estático e deixar a plataforma escolher",
    }
  );
}

export interface DestinationAdvice {
  level: "ok" | "attention";
  message: string;
}

export function assessDestination(params: {
  platform: TrafegoPlatform;
  objective: TrafegoObjective;
  destinationUrl?: string | null;
  whatsappNumber?: string | null;
}): DestinationAdvice {
  const hasSite = Boolean(params.destinationUrl?.trim());
  const hasWhatsapp = Boolean(params.whatsappNumber?.trim());

  if (params.objective === "SALES" && !hasSite) {
    return {
      level: "attention",
      message:
        "Venda direta sem site: o cliente vai fechar pelo WhatsApp, então alguém precisa responder rápido — tempo de resposta é o que decide a venda aqui.",
    };
  }
  if (hasSite && (params.objective === "SALES" || params.objective === "LEADS")) {
    return {
      level: "attention",
      message:
        "Com site como destino, o pixel precisa estar instalado antes de subir a campanha. Sem ele a plataforma não aprende quem converte e o custo por resultado não cai.",
    };
  }
  if (!hasSite && !hasWhatsapp) {
    return {
      level: "attention",
      message: "Ainda falta dizer para onde mandar quem clicar no anúncio.",
    };
  }
  return {
    level: "ok",
    message: hasWhatsapp
      ? "WhatsApp como destino funciona bem para serviço local — combine quem responde e em quanto tempo."
      : "Destino definido.",
  };
}
