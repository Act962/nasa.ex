import "server-only";

import prisma from "@/lib/prisma";
import { getPresignedReadUrl } from "@/lib/r2-url";
import {
  CAMPAIGN_TYPE_LABEL,
  OBJECTIVE_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { trafegoCreativeDraftSchema } from "@/features/trafego/lib/creative-review/schema";
import {
  buildPublishPrompt,
  type PublishPromptResult,
} from "@/features/trafego/lib/publish-prompt";
import type { MetaConnectionCheck } from "@/features/integrations/lib/meta-connection-check";
import { trafegoPanelUrl } from "@/features/trafego/lib/urls";
import { sendTrafegoClientWhatsapp } from "./send-client-whatsapp";

/**
 * Roteiro de publicação e recomendação para o cliente aprovar (spec 0130, RF-6, RF-7). Usado pelo admin e
 * pelo MCP do ÓRBITA (spec 0131, D-3): uma regra só, duas portas. Quem chama confere a permissão.
 */

const CREATIVE_LINK_SECONDS = 24 * 60 * 60;

export class TrafegoOrderNotFoundError extends Error {
  constructor() {
    super("Pedido não encontrado.");
  }
}

export async function loadOrderPublishPrompt(
  orderId: string,
): Promise<PublishPromptResult> {
  const order = await prisma.trafegoOrder.findUnique({
    where: { id: orderId },
    select: {
      code: true,
      organizationId: true,
      businessName: true,
      businessNiche: true,
      objective: true,
      campaignType: true,
      targetAudience: true,
      adBudgetBrlCents: true,
      durationDays: true,
      desiredStartAt: true,
      materialsProfileLink: true,
      pendingPurchase: { select: { briefing: true } },
      creatives: {
        where: { status: { not: "REJECTED" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { fileKey: true, kind: true, fileName: true },
      },
      copies: {
        orderBy: [{ isSelected: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { primaryText: true, headline: true },
      },
    },
  });
  if (!order) throw new TrafegoOrderNotFoundError();

  const integration = await prisma.platformIntegration.findUnique({
    where: {
      organizationId_platform: {
        organizationId: order.organizationId,
        platform: "META",
      },
    },
    select: { isActive: true, config: true },
  });
  const config = (integration?.isActive ? integration.config : null) as {
    adAccountId?: string;
    connectionCheck?: Pick<MetaConnectionCheck, "pages">;
  } | null;
  const page = config?.connectionCheck?.pages?.[0] ?? null;

  const briefing = (order.pendingPurchase?.briefing ?? {}) as Record<
    string,
    unknown
  >;
  const draftResult = trafegoCreativeDraftSchema.safeParse(
    briefing.creativeDraft,
  );
  const draft = draftResult.success ? draftResult.data : null;
  const [creative] = order.creatives;
  const [copy] = order.copies;

  return buildPublishPrompt({
    code: order.code,
    businessName: order.businessName ?? "Negócio",
    businessNiche: order.businessNiche,
    objectiveLabel: OBJECTIVE_LABEL[order.objective],
    campaignTypeLabel: CAMPAIGN_TYPE_LABEL[order.campaignType],
    targetAudience: order.targetAudience,
    adBudgetBrlCents: order.adBudgetBrlCents,
    durationDays: order.durationDays,
    desiredStartAt: order.desiredStartAt
      ? order.desiredStartAt.toLocaleDateString("pt-BR")
      : null,
    adAccountId: config?.adAccountId?.trim() || null,
    page: page
      ? {
          id: page.id,
          name: page.name,
          whatsappNumber: page.whatsappNumber,
          instagramUsername: page.instagramUsername,
        }
      : null,
    copy: copy ? { message: copy.primaryText, headline: copy.headline } : null,
    initialMessage: draft?.initialMessage ?? null,
    creative: creative
      ? {
          url: await getPresignedReadUrl(
            creative.fileKey,
            CREATIVE_LINK_SECONDS,
          ),
          kind: creative.kind,
          fileName: creative.fileName,
        }
      : null,
    postLink: draft?.postLink ?? order.materialsProfileLink,
    guidance: draft?.guidance ?? null,
  });
}

export async function sendRecommendationForApproval(params: {
  orderId: string;
  recommendation: string;
  actorUserId: string;
  /** Nome da chave de IA externa, quando a recomendação vem pelo MCP (spec 0131, RF-5). */
  viaLabel?: string;
}): Promise<{ eventId: string }> {
  const order = await prisma.trafegoOrder.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      code: true,
      status: true,
      leadId: true,
      owner: { select: { phone: true } },
      pendingPurchase: { select: { phone: true } },
    },
  });
  if (!order) throw new TrafegoOrderNotFoundError();

  const now = new Date();
  const event = await prisma.$transaction(async (tx) => {
    // Uma recomendação aberta por vez (RF-10): a anterior sem resposta fica "substituída".
    await tx.trafegoOrderEvent.updateMany({
      where: {
        orderId: order.id,
        requiresApproval: true,
        approvedAt: null,
        supersededAt: null,
      },
      data: { supersededAt: now },
    });
    // A origem fica numa nota interna: o cliente não vê o nome da chave.
    if (params.viaLabel) {
      await tx.trafegoOrderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          title: `Recomendação enviada via IA externa · ${params.viaLabel}`,
          isClientVisible: false,
          actorUserId: params.actorUserId,
          source: "ADMIN",
        },
      });
    }
    return tx.trafegoOrderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        title: "Recomendação da equipe — precisa de aprovação",
        detail: params.recommendation,
        isClientVisible: true,
        actorUserId: params.actorUserId,
        source: "ADMIN",
        requiresApproval: true,
      },
      select: { id: true },
    });
  });

  // Aviso depois do commit, sem travar o envio (regra 18).
  const phone = order.pendingPurchase?.phone ?? order.owner.phone;
  if (phone) {
    await sendTrafegoClientWhatsapp({
      phone,
      leadId: order.leadId,
      text: `A equipe do trafeGO tem uma recomendação para a campanha ${order.code} e precisa da sua aprovação para seguir. Veja no painel: ${trafegoPanelUrl(order.id)}`,
    }).catch((error) =>
      console.warn("[trafego/approval] aviso ao cliente falhou:", error),
    );
  }

  return { eventId: event.id };
}
