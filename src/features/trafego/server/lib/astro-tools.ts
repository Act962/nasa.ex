import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  parseAccessChecklist,
  parseRelease,
  parseReleaseSources,
  ACCESS_CHECKLIST_ITEMS,
  type ReleaseSource,
} from "@/features/trafego/lib/release";
import {
  isPubliclyFetchable,
  normalizeSiteUrl,
} from "@/features/trafego/server/lib/release/fetch-site";
import { buildTrafegoRecommendations } from "@/features/trafego/server/lib/recommendations";
import { prescreenAdContent } from "@/features/trafego/lib/ad-policies";
import { ORDER_STATUS_LABEL } from "@/features/trafego/lib/order-status";
import { CLIENT_STATUS_COPY } from "@/features/trafego/lib/client-notifications";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { inngest } from "@/inngest/client";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";

/**
 * Tools do Astro dentro do painel trafeGO.
 *
 * Escopo fechado de propósito: o cliente aqui é o dono de uma campanha, não um
 * membro da plataforma. Ele não pode listar leads, criar automação nem ver
 * outra org — só o que pertence aos pedidos da própria organização. Toda query
 * filtra por `ctx.organizationId`; nenhuma tool aceita `organizationId` do
 * modelo.
 */
export function buildTrafegoAstroTools(ctx: AgentContext): ToolSet {
  const orderScope = { organizationId: ctx.organizationId };

  /** Resolve o pedido pelo código (TG-0007) ou usa o mais recente da org. */
  async function resolveOrder(code?: string | null) {
    return prisma.trafegoOrder.findFirst({
      where: code ? { ...orderScope, code: code.trim().toUpperCase() } : orderScope,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        status: true,
        platform: true,
        objective: true,
        businessName: true,
        businessNiche: true,
        targetAudience: true,
        adBudgetBrlCents: true,
        durationDays: true,
        earliestStartAt: true,
        desiredStartAt: true,
        release: true,
        releaseSources: true,
        releaseSavedAt: true,
        releaseGeneratedAt: true,
        accessChecklist: true,
      },
    });
  }

  return {
    get_my_orders: tool({
      description:
        "Lista as campanhas do cliente com código, fase atual e investimento. Use antes de qualquer outra tool quando não souber de qual campanha ele fala.",
      inputSchema: z.object({}),
      execute: async () => {
        const orders = await prisma.trafegoOrder.findMany({
          where: orderScope,
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            code: true,
            status: true,
            platform: true,
            businessName: true,
            adBudgetBrlCents: true,
            createdAt: true,
          },
        });
        return orders.map((order) => ({
          code: order.code,
          fase: ORDER_STATUS_LABEL[order.status],
          plataforma: order.platform,
          empresa: order.businessName,
          verba: formatBrlFromCents(order.adBudgetBrlCents),
          criadaEm: order.createdAt.toISOString().slice(0, 10),
        }));
      },
    }),

    explain_status: tool({
      description:
        "Explica em que fase a campanha está, o que a equipe faz agora e o que depende do cliente.",
      inputSchema: z.object({
        code: z.string().optional().describe("Código da campanha, ex: TG-0007"),
      }),
      execute: async ({ code }) => {
        const order = await resolveOrder(code);
        if (!order) return { erro: "Nenhuma campanha encontrada." };
        return {
          code: order.code,
          fase: ORDER_STATUS_LABEL[order.status],
          oQueAcontece: CLIENT_STATUS_COPY[order.status]?.title ?? null,
          inicioEstimado: order.earliestStartAt?.toISOString().slice(0, 10) ?? null,
        };
      },
    }),

    get_release: tool({
      description: "Mostra o Release atual da empresa e quais fontes já foram lidas.",
      inputSchema: z.object({ code: z.string().optional() }),
      execute: async ({ code }) => {
        const order = await resolveOrder(code);
        if (!order) return { erro: "Nenhuma campanha encontrada." };
        const sources = parseReleaseSources(order.releaseSources);
        return {
          code: order.code,
          release: parseRelease(order.release),
          salvo: Boolean(order.releaseSavedAt),
          fontes: sources.map((source) => ({
            id: source.id,
            tipo: source.kind,
            valor: source.value,
            lida: Boolean(source.extractedAt),
            observacao: source.note ?? null,
          })),
        };
      },
    }),

    add_release_source: tool({
      description:
        "Adiciona uma fonte ao Release: site, PDF já enviado, Instagram ou Facebook. Só site e PDF são lidos automaticamente.",
      inputSchema: z.object({
        code: z.string().optional(),
        kind: z.enum(["site", "pdf", "instagram", "facebook"]),
        value: z.string().min(2).max(400).describe("URL, @ do perfil ou nome do arquivo"),
        fileKey: z.string().max(300).optional().describe("Obrigatório para PDF"),
      }),
      execute: async ({ code, kind, value, fileKey }) => {
        const order = await resolveOrder(code);
        if (!order) return { erro: "Nenhuma campanha encontrada." };
        if (kind === "pdf" && !fileKey) {
          return { erro: "O PDF precisa ser enviado pelo painel antes — peça o upload ao cliente." };
        }
        if (kind === "site" && !isPubliclyFetchable(value)) {
          return { erro: "Endereço inválido. Precisa ser um site público com http ou https." };
        }

        const sources = parseReleaseSources(order.releaseSources);
        if (sources.length >= 8) return { erro: "Já são 8 fontes — remova alguma antes." };

        const source: ReleaseSource = {
          id: randomUUID(),
          kind,
          value: kind === "site" ? normalizeSiteUrl(value) : value,
          fileKey: fileKey ?? null,
          extractedAt: null,
          chars: null,
          note:
            kind === "instagram" || kind === "facebook"
              ? "Guardado como referência — redes sociais não são lidas automaticamente."
              : null,
        };
        await prisma.trafegoOrder.update({
          where: { id: order.id },
          data: { releaseSources: [...sources, source] as unknown as object },
        });
        return { adicionada: source.value, total: sources.length + 1 };
      },
    }),

    generate_release: tool({
      description:
        "Manda ler as fontes e redigir o Release. Demora — avise que o resultado aparece no painel em instantes.",
      inputSchema: z.object({ code: z.string().optional() }),
      execute: async ({ code }) => {
        const order = await resolveOrder(code);
        if (!order) return { erro: "Nenhuma campanha encontrada." };
        const readable = parseReleaseSources(order.releaseSources).filter(
          (source) => source.kind === "site" || source.kind === "pdf",
        );
        if (readable.length === 0) {
          return { erro: "Sem site nem PDF para ler. Peça o endereço do site ou o catálogo em PDF." };
        }
        await inngest.send({ name: "trafego/release.generate", data: { orderId: order.id } });
        return { enfileirado: true, fontes: readable.length };
      },
    }),

    get_recommendations: tool({
      description:
        "Recomendações para a campanha: formato de criativo, adequação da verba, destino e próximos passos.",
      inputSchema: z.object({ code: z.string().optional() }),
      execute: async ({ code }) => {
        const order = await resolveOrder(code);
        if (!order) return { erro: "Nenhuma campanha encontrada." };
        const recommendations = await buildTrafegoRecommendations(order.id);
        return recommendations ?? { erro: "Não foi possível gerar recomendações agora." };
      },
    }),

    check_ad_compliance: tool({
      description:
        "Verifica se um texto de anúncio, produto ou oferta bate nas políticas da plataforma. Use SEMPRE que o cliente citar produto de saúde, emagrecimento, promessa de resultado ou renda.",
      inputSchema: z.object({
        code: z.string().optional(),
        text: z.string().min(2).max(3000).describe("O texto, produto ou oferta a verificar"),
      }),
      execute: async ({ code, text }) => {
        const order = await resolveOrder(code);
        const result = prescreenAdContent({
          platform: order?.platform ?? "META_ADS",
          texts: [text],
        });
        return {
          nivel: result.level,
          problemas: result.hits.map((hit) => ({
            regra: hit.label,
            trecho: hit.excerpt,
            porque: hit.reason,
            comoResolver: hit.fix,
            fonte: hit.sourceUrl,
          })),
        };
      },
    }),

    get_access_checklist: tool({
      description: "Mostra quais acessos o cliente já liberou e o que ainda falta para publicar.",
      inputSchema: z.object({ code: z.string().optional() }),
      execute: async ({ code }) => {
        const order = await resolveOrder(code);
        if (!order) return { erro: "Nenhuma campanha encontrada." };
        const checklist = parseAccessChecklist(order.accessChecklist);
        const settings = await loadTrafegoSettings();
        return {
          businessIdDaAgencia: settings.partnerBusinessId,
          itens: ACCESS_CHECKLIST_ITEMS.map((item) => ({
            id: item.id,
            item: item.label,
            feito: checklist[item.id] === true,
          })),
        };
      },
    }),

    contact_team: tool({
      description: "Devolve o WhatsApp da equipe quando o cliente precisa falar com uma pessoa.",
      inputSchema: z.object({}),
      execute: async () => {
        const settings = await loadTrafegoSettings();
        return {
          whatsapp: settings.supportWhatsapp,
          horario: "Segunda a sexta, horário comercial.",
        };
      },
    }),
  };
}

/** Addendum de persona: o Astro do painel fala com o dono do negócio. */
export const TRAFEGO_SCOPE_PROMPT = `
[ESCOPO trafeGO]
Você está no painel de um cliente que contratou tráfego pago. Ele é dono de um
negócio pequeno, não entende de anúncios e não trabalha na plataforma.

- Responda só sobre as campanhas dele: fase, Release, materiais, recomendações,
  políticas de anúncio e prazos. Qualquer outro assunto — inclusive perguntas
  gerais que você saberia responder — NÃO deve ser respondido: diga que aqui
  você só cuida das campanhas dele e ofereça o WhatsApp da equipe.
- Nunca invente número de resultado, prazo ou valor. Se não veio de uma tool,
  você não sabe.
- Explique sem jargão. "Criativo" é a imagem ou o vídeo; "copy" é o texto.
- Quando ele citar produto ou promessa de saúde, emagrecimento ou renda, chame
  check_ad_compliance ANTES de opinar.
- Escreva em texto corrido, sem asteriscos, sem markdown.
`.trim();
