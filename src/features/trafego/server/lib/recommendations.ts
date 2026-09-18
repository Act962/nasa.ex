import "server-only";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import {
  assessBudget,
  assessDestination,
  recommendFormat,
  type CreativeFormat,
} from "@/features/trafego/lib/recommendation-rules";

/**
 * Orientação para quem não entende de tráfego: que formato de criativo mandar,
 * se a verba comporta o objetivo, e o que fazer a seguir.
 *
 * A divisão é deliberada: **as regras duras decidem** (verba mínima por dia,
 * formato por objetivo, destino × pixel) e o modelo só escreve o texto em
 * cima do veredito. Sem chave de modelo, a recomendação continua existindo —
 * só com a redação padrão. Nunca o contrário: número inventado por modelo
 * viraria conselho diferente a cada refresh.
 */
export interface TrafegoRecommendations {
  creativeFormat: { format: CreativeFormat; label: string; text: string };
  budget: { level: string; dailyLabel: string; text: string };
  destination: { level: string; text: string };
  nextSteps: string[];
  copyAngle: string | null;
  generatedAt: string;
  writtenByModel: boolean;
}

const FORMAT_LABEL: Record<CreativeFormat, string> = {
  video: "Vídeo",
  static: "Imagem",
  both: "Vídeo e imagem",
  text: "Texto",
};

const narrativeSchema = z.object({
  creativeText: z.string().max(360),
  budgetText: z.string().max(360),
  copyAngle: z.string().max(280),
  nextSteps: z.array(z.string().max(160)).min(1).max(5),
});

export async function buildTrafegoRecommendations(
  orderId: string,
): Promise<TrafegoRecommendations | null> {
  const order = await prisma.trafegoOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      platform: true,
      objective: true,
      campaignType: true,
      adBudgetBrlCents: true,
      durationDays: true,
      businessName: true,
      businessNiche: true,
      targetAudience: true,
      destinationUrl: true,
      whatsappNumber: true,
      release: true,
      materialsProfileLink: true,
      _count: {
        select: {
          creatives: true,
          copies: { where: { isSelected: true } },
        },
      },
    },
  });
  if (!order) return null;

  // ── Veredito das regras ──
  const budget = assessBudget({
    platform: order.platform,
    adBudgetBrlCents: order.adBudgetBrlCents,
    durationDays: order.durationDays,
  });
  const format = recommendFormat(order.objective);
  const destination = assessDestination({
    platform: order.platform,
    objective: order.objective,
    destinationUrl: order.destinationUrl,
    whatsappNumber: order.whatsappNumber,
  });

  const dailyLabel = `${formatBrlFromCents(budget.dailyBrlCents)} por dia`;
  const fallbackBudgetText =
    budget.level === "below_minimum"
      ? `Com ${dailyLabel}, a campanha fica abaixo do mínimo de ${formatBrlFromCents(budget.minDailyBrlCents)} que o ${PLATFORM_SHORT_LABEL[order.platform]} precisa para sair da fase de aprendizado. Vale aumentar a verba ou encurtar o período para concentrar o investimento.`
      : budget.level === "tight"
        ? `${dailyLabel} funciona, mas o resultado vai oscilar bastante de um dia para o outro — é pouco para a plataforma otimizar com folga.`
        : `${dailyLabel} dá margem para a plataforma testar públicos e criativos e baixar o custo por resultado.`;

  const steps: string[] = [];
  if (order._count.creatives === 0 && !order.materialsProfileLink) {
    steps.push("Envie pelo menos um criativo ou informe seu perfil na aba Materiais");
  }
  if (order._count.copies === 0) steps.push("Escreva ou escolha uma copy");
  if (!order.release) steps.push("Monte o Release do seu negócio — ele melhora as copies sugeridas");
  if (destination.level === "attention") steps.push("Confirme o destino do anúncio");
  if (steps.length === 0) steps.push("Clique em Ativar campanha para enviar à nossa equipe");

  let narrative: z.infer<typeof narrativeSchema> | null = null;
  if (process.env.OPENAI_API_KEY) {
    try {
      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: narrativeSchema,
        system: [
          "Você orienta donos de negócio pequeno que não entendem de tráfego pago.",
          "Português do Brasil, frases curtas, sem jargão. Explique todo termo técnico que usar.",
          "NUNCA prometa resultado, venda ou retorno. NUNCA invente números.",
          "Use apenas os vereditos que receber — eles já foram calculados. Seu trabalho é explicar o porquê em linguagem de gente.",
          "Em nextSteps, reescreva os passos pendentes que receber — MESMA quantidade, MESMA ordem, mesmo significado. Não acrescente nem remova passo.",
        ].join("\n"),
        prompt: JSON.stringify({
          negocio: order.businessName,
          ramo: order.businessNiche,
          publico: order.targetAudience,
          canal: PLATFORM_SHORT_LABEL[order.platform],
          objetivo: OBJECTIVE_LABEL[order.objective],
          verbaDiaria: dailyLabel,
          vereditoVerba: budget.level,
          formatoRecomendado: FORMAT_LABEL[format.format],
          motivoDoFormato: format.reason,
          destino: destination.message,
          release: order.release ?? null,
          passosPendentes: steps,
        }),
        maxRetries: 1,
      });
      narrative = object;
    } catch (error) {
      console.warn("[trafego/recommendations] redação pelo modelo falhou:", error);
    }
  }

  return {
    creativeFormat: {
      format: format.format,
      label: FORMAT_LABEL[format.format],
      text:
        narrative?.creativeText ??
        `Para ${OBJECTIVE_LABEL[order.objective].toLowerCase()}, ${format.reason}.`,
    },
    budget: {
      level: budget.level,
      dailyLabel,
      text: narrative?.budgetText ?? fallbackBudgetText,
    },
    destination: { level: destination.level, text: destination.message },
    // Quais passos existem é decisão das regras; o modelo só reescreve a frase.
    // Aceitar a lista dele inteira deixaria um pendente real sumir da tela.
    nextSteps:
      narrative?.nextSteps?.length === steps.length ? narrative.nextSteps : steps,
    copyAngle: narrative?.copyAngle ?? null,
    generatedAt: new Date().toISOString(),
    writtenByModel: Boolean(narrative),
  };
}

/** Gera e guarda no pedido. Best-effort: falhar aqui não quebra nada. */
export async function refreshTrafegoRecommendations(orderId: string): Promise<void> {
  const recommendations = await buildTrafegoRecommendations(orderId);
  if (!recommendations) return;
  await prisma.trafegoOrder.update({
    where: { id: orderId },
    data: {
      recommendations: recommendations as unknown as object,
      recommendationsGeneratedAt: new Date(),
    },
  });
}
