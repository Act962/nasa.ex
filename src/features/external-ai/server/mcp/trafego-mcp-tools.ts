import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import prisma from "@/lib/prisma";
import { getPresignedReadUrl } from "@/lib/r2-url";
import { takeRateLimit } from "@/lib/rate-limit";
import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import { CAMPAIGN_TYPE_LABEL, OBJECTIVE_LABEL } from "@/features/trafego/lib/catalog-labels";
import { trafegoCreativeDraftSchema } from "@/features/trafego/lib/creative-review/schema";
import { ORDER_STATUS_LABEL, TERMINAL_ORDER_STATUSES, isOrderBeforeLaunch } from "@/features/trafego/lib/order-status";
import { PERFORMANCE_RANGES, resolvePerformancePeriod } from "@/features/trafego/lib/order-meta-metrics";
import { compareWithAverage, type AdMetrics } from "@/features/trafego/lib/order-ads-metrics";
import { AD_METRIC_LABELS, diagnoseIndicator } from "@/features/trafego/lib/quality-diagnosis";
import { describeTeamActions, normalizeOrderCode } from "@/features/trafego/lib/team-actions";
import type { MetaConnectionCheck } from "@/features/integrations/lib/meta-connection-check";
import { loadOrderPublishPrompt, sendRecommendationForApproval } from "@/features/trafego/server/lib/order-publish";
import { linkOrderToMetaCampaign } from "@/features/trafego/server/lib/link-meta-campaign";
import { listOrderReviewQueue } from "@/features/trafego/server/lib/order-review";
import { resolveOrderMetaAccess } from "@/features/trafego/server/lib/meta/order-meta-access";
import { getOrderAdsPerformance } from "@/features/trafego/server/lib/meta/order-ads-performance";
import { TRAFEGO_SCOPE, isSystemAdmin, type ExternalAiCaller } from "../access-tokens";

/**
 * Ferramentas do trafeGO no MCP do ÓRBITA, só para a equipe (spec 0131). Leem os pedidos de todas as
 * empresas e devolvem recomendação e vínculo de campanha. Nunca mexem na Meta nem em dinheiro (D-2).
 */

const LIST_LIMIT = 50;
const CREATIVE_LINK_SECONDS = 24 * 60 * 60;
const RATE_LIMIT = { max: 120, windowMs: 60 * 60 * 1000 };
const INSIGHT_METRICS: (keyof AdMetrics)[] = ["costPerConversationCents", "ctr", "cpcCents", "cpmCents", "conversationRate", "frequency"];

export type ToolResult = {
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
  isError?: boolean;
};

export const asResult = (data: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const asError = (message: string): ToolResult => ({ content: [{ type: "text", text: message }], isError: true });

/** Escopo na chave e admin do sistema conferidos a cada chamada (RF-2, CA-3). `work` devolve o resultado pronto. */
export async function guardTrafegoTool(caller: ExternalAiCaller, work: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    if (!caller.scopes.includes(TRAFEGO_SCOPE) || !(await isSystemAdmin(caller.userId))) {
      return asError("Esta chave não tem acesso às ferramentas do trafeGO. Só a equipe do ÓRBITA gera chave com esse escopo.");
    }
    const limit = takeRateLimit("mcp-trafego", caller.tokenId, RATE_LIMIT);
    if (!limit.allowed) return asError(`Muitas chamadas seguidas. Tente de novo em ${Math.ceil(limit.retryAfterSeconds / 60)} min.`);
    return await work();
  } catch (error) {
    return asError(error instanceof Error ? error.message : "Erro inesperado.");
  }
}

function runTrafegoTool(caller: ExternalAiCaller, work: () => Promise<unknown>): Promise<ToolResult> {
  return guardTrafegoTool(caller, async () => asResult(await work()));
}

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function findOrderByCode(code: string) {
  const order = await prisma.trafegoOrder.findUnique({
    where: { code: normalizeOrderCode(code) },
    select: { id: true, code: true, organizationId: true, status: true, metaCampaignExternalId: true, startedAt: true, createdAt: true },
  });
  if (!order) throw new Error(`Pedido ${normalizeOrderCode(code)} não encontrado. Use trafego_list_orders para ver os códigos.`);
  return order;
}

async function loadMetaSetup(organizationId: string) {
  const integration = await prisma.platformIntegration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "META" } },
    select: { isActive: true, config: true },
  });
  const config = (integration?.isActive ? integration.config : null) as
    | { adAccountId?: string; connectionCheck?: Pick<MetaConnectionCheck, "pages" | "canRead" | "canCreate" | "errorMessage"> }
    | null;
  if (!config?.adAccountId) return { isConnected: false as const };
  return {
    isConnected: true as const,
    adAccountId: config.adAccountId,
    canRead: config.connectionCheck?.canRead ?? null,
    canCreate: config.connectionCheck?.canCreate ?? null,
    pages: (config.connectionCheck?.pages ?? []).map((page) => ({
      id: page.id,
      name: page.name,
      instagram: page.instagramUsername ? `@${page.instagramUsername}` : null,
      whatsapp: page.whatsappNumber,
    })),
  };
}

export function registerTrafegoMcpTools(server: McpServer, caller: ExternalAiCaller) {
  server.registerTool(
    "trafego_list_orders",
    {
      description:
        "Pedidos do trafeGO de todas as empresas, com o que a equipe precisa fazer em cada um (montar campanha, cliente aprovou, falta material, parado há dias) e se está esperando o cliente aprovar. Comece por aqui.",
      inputSchema: {
        onlyNeedsAction: z.boolean().optional().describe("Padrão true: só pedidos com ação da equipe ou esperando o cliente"),
        status: z.string().optional().describe("Filtra por status, ex.: IN_REVIEW, RUNNING"),
        company: z.string().optional().describe("Parte do nome da empresa"),
      },
    },
    ({ onlyNeedsAction, status, company }) =>
      runTrafegoTool(caller, async () => {
        const reviewQueue = await listOrderReviewQueue(LIST_LIMIT);
        const pendingReviewCodes = new Set(reviewQueue.toReview.map((item) => item.code));
        const readyToPublishCodes = new Set(reviewQueue.toPublish.map((item) => item.code));
        const orders = await prisma.trafegoOrder.findMany({
          where: {
            ...(status ? { status: status.toUpperCase() as TrafegoOrderStatus } : { status: { notIn: [...TERMINAL_ORDER_STATUSES, "COMPLETED"] } }),
            ...(company ? { organization: { name: { contains: company, mode: "insensitive" } } } : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: 200,
          select: {
            code: true,
            status: true,
            businessName: true,
            adBudgetBrlCents: true,
            metaCampaignExternalId: true,
            updatedAt: true,
            organization: { select: { name: true } },
            _count: { select: { creatives: { where: { status: { not: "REJECTED" } } }, copies: true } },
            events: {
              where: { requiresApproval: true, supersededAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { approvedAt: true },
            },
          },
        });

        const rows = orders.map((order) => {
          const [latestRecommendation] = order.events;
          const summary = describeTeamActions({
            status: order.status,
            hasCreative: order._count.creatives > 0,
            hasCopy: order._count.copies > 0,
            hasLinkedCampaign: Boolean(order.metaCampaignExternalId),
            hasPendingApproval: Boolean(latestRecommendation && !latestRecommendation.approvedAt),
            hasApprovalToPublish: Boolean(latestRecommendation?.approvedAt) && isOrderBeforeLaunch(order.status),
            hasPendingCampaignReview: pendingReviewCodes.has(order.code),
            isReadyToPublish: readyToPublishCodes.has(order.code),
            lastActivityAt: order.updatedAt,
          });
          return {
            code: order.code,
            company: order.organization.name,
            business: order.businessName,
            status: ORDER_STATUS_LABEL[order.status],
            budget: formatBrl(order.adBudgetBrlCents),
            actions: summary.actions,
            waitingOn: summary.waitingOn,
            idleDays: summary.idleDays,
          };
        });
        const filtered = onlyNeedsAction === false ? rows : rows.filter((row) => row.actions.length > 0 || row.waitingOn);
        return { total: filtered.length, orders: filtered.slice(0, LIST_LIMIT) };
      }),
  );

  server.registerTool(
    "trafego_get_order",
    {
      description:
        "Pedido completo: briefing, público, verba, datas, criativos (link de 24 h), textos, mensagem inicial do WhatsApp, orientação do Astro, conta e página da Meta da empresa, histórico e recomendações com o estado.",
      inputSchema: { code: z.string().describe("Código do pedido, ex.: TG-0042") },
    },
    ({ code }) =>
      runTrafegoTool(caller, async () => {
        const { id } = await findOrderByCode(code);
        const order = await prisma.trafegoOrder.findUniqueOrThrow({
          where: { id },
          select: {
            code: true,
            status: true,
            organizationId: true,
            businessName: true,
            businessNiche: true,
            objective: true,
            campaignType: true,
            targetAudience: true,
            destinationUrl: true,
            whatsappNumber: true,
            adBudgetBrlCents: true,
            durationDays: true,
            desiredStartAt: true,
            startedAt: true,
            endsAt: true,
            metaCampaignExternalId: true,
            materialsProfileLink: true,
            notes: true,
            organization: { select: { name: true } },
            pendingPurchase: { select: { briefing: true } },
            creatives: {
              orderBy: { createdAt: "desc" },
              take: 10,
              select: { fileKey: true, kind: true, fileName: true, status: true, astroReview: true },
            },
            copies: {
              orderBy: [{ isSelected: "desc" }, { createdAt: "desc" }],
              take: 5,
              select: { headline: true, primaryText: true, isSelected: true, complianceLevel: true },
            },
            events: {
              orderBy: { createdAt: "desc" },
              take: 20,
              select: {
                title: true,
                detail: true,
                isClientVisible: true,
                createdAt: true,
                requiresApproval: true,
                approvedAt: true,
                supersededAt: true,
                approvedBy: { select: { name: true } },
              },
            },
          },
        });
        const draftResult = trafegoCreativeDraftSchema.safeParse(((order.pendingPurchase?.briefing ?? {}) as Record<string, unknown>).creativeDraft);
        const draft = draftResult.success ? draftResult.data : null;

        return {
          code: order.code,
          company: order.organization.name,
          status: ORDER_STATUS_LABEL[order.status],
          business: { name: order.businessName, niche: order.businessNiche, destinationUrl: order.destinationUrl },
          campaign: {
            type: CAMPAIGN_TYPE_LABEL[order.campaignType],
            objective: OBJECTIVE_LABEL[order.objective],
            audience: order.targetAudience,
            budget: formatBrl(order.adBudgetBrlCents),
            durationDays: order.durationDays,
            desiredStartAt: order.desiredStartAt?.toISOString().slice(0, 10) ?? null,
            startedAt: order.startedAt?.toISOString().slice(0, 10) ?? null,
            endsAt: order.endsAt?.toISOString().slice(0, 10) ?? null,
            linkedMetaCampaignId: order.metaCampaignExternalId,
          },
          creatives: await Promise.all(
            order.creatives.map(async (creative) => ({
              kind: creative.kind,
              fileName: creative.fileName,
              status: creative.status,
              url: await getPresignedReadUrl(creative.fileKey, CREATIVE_LINK_SECONDS),
              astroScore: (creative.astroReview as { score?: number } | null)?.score ?? null,
            })),
          ),
          instagramPostLink: draft?.postLink ?? order.materialsProfileLink,
          copies: order.copies.map((copy) => ({
            headline: copy.headline,
            text: copy.primaryText,
            isSelected: copy.isSelected,
            policyCheck: copy.complianceLevel,
          })),
          initialWhatsappMessage: draft?.initialMessage ?? null,
          astroGuidance: draft?.guidance ?? null,
          clientWhatsapp: order.whatsappNumber,
          meta: await loadMetaSetup(order.organizationId),
          notes: order.notes,
          history: order.events.map((event) => ({
            date: event.createdAt.toISOString().slice(0, 16).replace("T", " "),
            title: event.title,
            detail: event.detail,
            visibleToClient: event.isClientVisible,
            approval: event.requiresApproval
              ? event.approvedAt
                ? `aprovada por ${event.approvedBy?.name ?? "cliente"} em ${event.approvedAt.toISOString().slice(0, 10)}`
                : event.supersededAt
                  ? "substituída"
                  : "esperando o cliente"
              : null,
          })),
        };
      }),
  );

  server.registerTool(
    "trafego_get_publish_brief",
    {
      description:
        "Roteiro para montar a campanha com o MCP da Meta: regras (tudo pausado, campanha de WhatsApp, nome com o código), dados do anúncio e o bloco de recomendações para o cliente. Siga ao pé da letra.",
      inputSchema: { code: z.string() },
    },
    ({ code }) =>
      runTrafegoTool(caller, async () => {
        const order = await findOrderByCode(code);
        const result = await loadOrderPublishPrompt(order.id);
        if (!result.ok) return { ready: false, missing: result.missing, message: `Falta ${result.missing.join(" e ")}. Peça ao cliente antes de montar.` };
        return { ready: true, pendingWithClient: result.pending, brief: result.text };
      }),
  );

  server.registerTool(
    "trafego_get_ad_insights",
    {
      description:
        "Números por anúncio do pedido (os mesmos do painel): conversas, custo por conversa, CTR, CPC, CPM, nota de qualidade e o diagnóstico de cada indicador ruim contra a média da conta.",
      inputSchema: { code: z.string(), range: z.enum(PERFORMANCE_RANGES).optional().describe("order (desde o início, padrão), last_7d ou last_30d") },
    },
    ({ code, range }) =>
      runTrafegoTool(caller, async () => {
        const order = await findOrderByCode(code);
        const access = await resolveOrderMetaAccess(order);
        if (access.mode === "legacy") return { available: false, message: "A empresa não conectou a Meta nos Satélites." };
        if (access.mode === "unavailable") return { available: false, message: access.message };
        const period = resolvePerformancePeriod({
          range: range ?? "order",
          orderStartedAt: order.startedAt,
          orderCreatedAt: order.createdAt,
          timeZone: access.account.timezoneName,
        });
        const performance = await getOrderAdsPerformance(access, order, period);
        return {
          available: true,
          period,
          campaignsFound: performance.campaignsCount,
          totals: performance.totals,
          ads: performance.ads.map((ad) => ({
            id: ad.id,
            name: ad.name,
            adset: ad.adsetName,
            status: ad.status,
            metrics: ad.metrics,
            quality: ad.quality,
            evaluateFrom: ad.evaluateFrom,
            problems: INSIGHT_METRICS.flatMap((metric) => {
              const comparison = compareWithAverage(metric, ad.metrics[metric], ad.benchmark?.[metric]);
              if (!comparison || comparison.tone !== "bad") return [];
              const diagnosis = diagnoseIndicator(metric, comparison.direction);
              return [
                {
                  metric: AD_METRIC_LABELS[metric],
                  vsAverage: `${comparison.percent}% ${comparison.direction === "up" ? "acima" : "abaixo"}`,
                  cause: diagnosis?.cause ?? null,
                  fix: diagnosis?.fix ?? null,
                },
              ];
            }),
          })),
        };
      }),
  );

  server.registerTool(
    "trafego_send_recommendation",
    {
      description:
        "Envia ao cliente a recomendação para ele aprovar no painel (aparece \"Precisa de aprovação\" e ele recebe WhatsApp). Substitui a anterior sem resposta. Escreva em linguagem simples, para o dono do negócio.",
      inputSchema: { code: z.string(), recommendation: z.string().min(10).max(4000) },
    },
    ({ code, recommendation }) =>
      runTrafegoTool(caller, async () => {
        const order = await findOrderByCode(code);
        await sendRecommendationForApproval({
          orderId: order.id,
          recommendation: recommendation.trim(),
          actorUserId: caller.userId,
          viaLabel: caller.label,
        });
        return { sent: true, message: "Enviada. O cliente vê \"Precisa de aprovação\" no painel." };
      }),
  );

  server.registerTool(
    "trafego_link_meta_campaign",
    {
      description: "Grava no pedido o id da campanha que você criou na Meta. Confere antes que a campanha é da conta de anúncios da empresa do pedido.",
      inputSchema: { code: z.string(), metaCampaignId: z.string().regex(/^\d{6,25}$/, "Use o id numérico da campanha") },
    },
    ({ code, metaCampaignId }) =>
      runTrafegoTool(caller, async () => {
        const order = await findOrderByCode(code);
        const result = await linkOrderToMetaCampaign({ orderId: order.id, metaCampaignId, actorUserId: caller.userId, viaLabel: caller.label });
        if (!result.ok) throw new Error(result.message);
        return { linked: true, campaign: result.campaignName };
      }),
  );

  server.registerTool(
    "trafego_add_team_note",
    {
      description: "Nota interna da equipe no histórico do pedido (o cliente não vê). Use para registrar o que foi feito na Meta.",
      inputSchema: { code: z.string(), note: z.string().min(3).max(2000) },
    },
    ({ code, note }) =>
      runTrafegoTool(caller, async () => {
        const order = await findOrderByCode(code);
        await prisma.trafegoOrderEvent.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: order.status,
            title: `Nota da equipe · via IA externa · ${caller.label}`,
            detail: note.trim(),
            isClientVisible: false,
            actorUserId: caller.userId,
            source: "ADMIN",
          },
        });
        return { saved: true };
      }),
  );
}
