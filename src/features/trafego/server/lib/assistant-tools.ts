import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { TrafegoPlatform } from "@/generated/prisma/enums";
import { quoteTrafego, resolveTrafegoSetupBrlCents, MIN_AD_BUDGET_BRL_CENTS } from "@/features/trafego/lib/pricing-tiers";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { prescreenAdContent } from "@/features/trafego/lib/ad-policies";
import { estimateEarliestStart, formatStartDate } from "@/features/trafego/lib/timeline";

/**
 * Ferramentas do assistente público. Todas são **somente leitura e puras** —
 * nenhuma toca o banco, cria pendência ou move dinheiro.
 *
 * É a diferença deliberada em relação ao Astro de dentro da plataforma, cujas
 * ferramentas escrevem na organização do usuário logado. Aqui não há usuário,
 * não há sessão, e qualquer escrita seria um vetor aberto na internet.
 */

const platformSchema = z
  .enum(["META_ADS", "GOOGLE_ADS", "WHATSAPP_OFICIAL"])
  .describe("Canal da campanha");

export const simulateInvestmentTool = tool({
  description:
    "Calcula o preço do serviço: 30% da verba com mínimo de R$ 150, setup e o total a pagar à Órbita. A verba é paga pelo cliente direto à Meta. Use SEMPRE que a conversa envolver valores — nunca calcule de cabeça.",
  inputSchema: z.object({
    verbaEmReais: z
      .number()
      .min(0)
      .describe("Quanto o cliente quer investir em anúncio, em reais (não centavos)"),
    canalWhatsappOficial: z.boolean().default(false).describe("true se a campanha é pelo WhatsApp Oficial"),
    temNumeroNaApiOficial: z
      .boolean()
      .default(false)
      .describe("Só no WhatsApp Oficial: true se o cliente já tem número na API Oficial"),
  }),
  execute: async ({ verbaEmReais, canalWhatsappOficial, temNumeroNaApiOficial }) => {
    const adBudgetBrlCents = Math.round(verbaEmReais * 100);
    // Visitante do site: ainda não tem empresa, então o setup único sempre entra (spec 0126).
    const setupBrlCents = resolveTrafegoSetupBrlCents({
      adBudgetBrlCents,
      isWhatsappChannel: canalWhatsappOficial,
      needsWhatsappNumber: !temNumeroNaApiOficial,
      hasPaidSetupBefore: false,
    });
    const quote = quoteTrafego(adBudgetBrlCents, setupBrlCents);
    return {
      verba: formatBrlFromCents(quote.adBudgetBrlCents),
      verbaPagaA: "direto à Meta, no cartão da conta de anúncios do cliente",
      taxaPercentual: quote.feePercent,
      taxaNoMinimo: quote.isMinimumFee,
      taxa: formatBrlFromCents(quote.serviceFeeBrlCents),
      setup:
        quote.setupBrlCents === 0
          ? "não se aplica"
          : `${formatBrlFromCents(quote.setupBrlCents)}, cobrado uma vez (configuração inicial da conta pela equipe)`,
      totalAPagarParaOrbita: formatBrlFromCents(quote.totalBrlCents),
      verbaMinima: formatBrlFromCents(MIN_AD_BUDGET_BRL_CENTS),
      complemento: "se o gasto real na Meta passar da verba declarada, cobramos 30% sobre a diferença",
    };
  },
});

export const checkPoliciesTool = tool({
  description:
    "Verifica se um produto, serviço ou texto de anúncio pode ser veiculado nas plataformas. Use antes de afirmar que algo pode ser anunciado.",
  inputSchema: z.object({
    texto: z.string().max(2000).describe("O que o cliente quer anunciar, nas palavras dele"),
    canal: platformSchema.optional(),
  }),
  execute: async ({ texto, canal }) => {
    const result = prescreenAdContent({
      platform: (canal as TrafegoPlatform | undefined) ?? null,
      texts: [texto],
    });
    return {
      situacao:
        result.level === "BLOCKED"
          ? "NAO_PODE_ANUNCIAR"
          : result.level === "WARNING"
            ? "PODE_COM_CUIDADO"
            : "SEM_RESTRICAO",
      pontos: result.hits.map((hit) => ({
        oQue: hit.label,
        porQue: hit.reason,
        comoResolver: hit.fix,
      })),
    };
  },
});

export const estimateStartTool = tool({
  description:
    "Estima a data mais cedo em que a campanha consegue entrar no ar, em dias úteis. Use sempre que a conversa envolver prazo.",
  inputSchema: z.object({
    temContaDeAnuncios: z.boolean().describe("Cliente já tem BM ou número na API Oficial"),
    redesVinculadas: z
      .boolean()
      .describe("Instagram e Facebook já vinculados à conta de anúncios"),
    materiaisProntos: z.boolean().describe("Criativos e textos já prontos"),
  }),
  execute: async ({ temContaDeAnuncios, redesVinculadas, materiaisProntos }) => {
    const estimate = estimateEarliestStart({
      hasAdAccount: temContaDeAnuncios,
      hasSocialLinked: redesVinculadas,
      materialsReady: materiaisProntos,
    });
    return {
      dataMaisCedo: formatStartDate(estimate.earliestStart),
      diasUteis: estimate.businessDays,
      oQuePrecisaAcontecer: estimate.reasons,
      observacao:
        "O prazo só começa a correr quando acessos e materiais estiverem liberados. A aprovação do anúncio depende da Meta e do Google.",
    };
  },
});

export function buildAssistantTools(supportWhatsapp: string | null) {
  return {
    simular_investimento: simulateInvestmentTool,
    checar_politicas: checkPoliciesTool,
    estimar_inicio: estimateStartTool,
    contato_da_equipe: tool({
      description: "Devolve o WhatsApp da equipe para casos que precisam de um gestor.",
      inputSchema: z.object({}),
      execute: async () => ({
        whatsapp: supportWhatsapp,
        disponivel: Boolean(supportWhatsapp),
        observacao: supportWhatsapp
          ? "Ofereça o botão de falar com um gestor que está na página."
          : "Não há WhatsApp configurado; oriente a preencher o formulário.",
      }),
    }),
  };
}
