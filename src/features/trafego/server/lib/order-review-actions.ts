import "server-only";

import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { canApproveByApplyingFixes, describeReviewFixes, readOrderReviewFixes } from "@/features/trafego/lib/order-review";
import { linkOrderToMetaCampaign } from "./link-meta-campaign";
import { resolveOrderMetaAccess } from "./meta/order-meta-access";
import { OrderReviewError, computeOrderFingerprint, isReleasedByClient } from "./order-review";
import { transitionTrafegoOrder } from "./transition-order";

/**
 * Lado do cliente e da publicação na avaliação (spec 0132, RF-5, RF-7): aplicar as melhorias guardadas e
 * marcar o pedido como publicado depois que o Claude cria a campanha pelo MCP da Meta.
 */

/**
 * "Avaliar melhorias e aprovar" (RF-5): grava no pedido exatamente o que o Claude pediu (o cliente não manda
 * valores). Sem observação, o pedido fica aprovado e liberado na versão nova; com observação, segue em ajustes.
 */
export async function applyOrderReviewFixes(params: { orderId: string; organizationId: string; userId: string; userName: string }) {
  const order = await prisma.trafegoOrder.findFirst({
    where: { id: params.orderId, organizationId: params.organizationId },
    select: {
      id: true,
      status: true,
      reviewFingerprint: true,
      reviewFixes: true,
      reviewNotes: true,
      pendingPurchaseId: true,
      pendingPurchase: { select: { briefing: true } },
      copies: { where: { isSelected: true }, orderBy: { position: "asc" }, take: 1, select: { id: true } },
    },
  });
  if (!order) throw new OrderReviewError("Pedido não encontrado.");
  const fixes = readOrderReviewFixes(order.reviewFixes);
  if (order.status !== "CHANGES_REQUESTED" || !order.reviewFingerprint || !fixes) {
    throw new OrderReviewError("Não há melhorias da equipe para aplicar neste pedido.");
  }

  const isApproved = canApproveByApplyingFixes({ fixes, notes: order.reviewNotes });
  const [selectedCopy] = order.copies;
  const briefing = (order.pendingPurchase?.briefing ?? {}) as Record<string, unknown>;
  const creativeDraft = (briefing.creativeDraft ?? {}) as Record<string, unknown>;

  await prisma.$transaction([
    ...((fixes.message || fixes.headline) && selectedCopy
      ? [
          prisma.trafegoCopy.update({
            where: { id: selectedCopy.id },
            data: {
              ...(fixes.message ? { primaryText: fixes.message } : {}),
              ...(fixes.headline ? { headline: fixes.headline } : {}),
            },
          }),
        ]
      : []),
    ...(fixes.initialMessage && order.pendingPurchaseId
      ? [
          prisma.trafegoPendingPurchase.update({
            where: { id: order.pendingPurchaseId },
            data: { briefing: { ...briefing, creativeDraft: { ...creativeDraft, initialMessage: fixes.initialMessage } } as Prisma.InputJsonObject },
          }),
        ]
      : []),
    prisma.trafegoOrder.update({
      where: { id: order.id },
      data: { ...(fixes.audience ? { targetAudience: fixes.audience } : {}), reviewFixes: Prisma.DbNull },
    }),
  ]);

  const detail = describeReviewFixes(fixes).join(" · ");
  if (!isApproved) {
    await prisma.trafegoOrderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        title: "Melhorias aplicadas — falta resolver os outros pontos",
        detail: `${detail} · por ${params.userName}`,
        isClientVisible: true,
        actorUserId: params.userId,
        source: "CLIENT",
      },
    });
    return { isApproved: false };
  }

  // A versão nova é exatamente a que o Claude escreveu: aprovada sem nova avaliação (RF-5).
  const now = new Date();
  await prisma.trafegoOrder.update({ where: { id: order.id }, data: { reviewFingerprint: await computeOrderFingerprint(order.id) } });
  await prisma.trafegoOrderEvent.updateMany({
    where: { orderId: order.id, requiresApproval: true, approvedAt: null, supersededAt: null },
    data: { approvedAt: now, approvedByUserId: params.userId },
  });
  await transitionTrafegoOrder({
    orderId: order.id,
    organizationId: params.organizationId,
    toStatus: "SCHEDULED",
    source: "CLIENT",
    actorUserId: params.userId,
    expectedFrom: ["CHANGES_REQUESTED"],
    title: "Melhorias aplicadas e publicação liberada",
    clientNote: `${detail}. A equipe publica em até 2 horas.`,
  });
  return { isApproved: true };
}

/**
 * Depois de criar a campanha pelo MCP da Meta (RF-7, CA-8): confere a liberação e a versão, vincula a campanha
 * e leva o pedido ao ar. Sem a Meta nos Satélites, o id é gravado sem conferência (o Claude da equipe é quem
 * criou) e a origem fica numa nota interna.
 */
export async function markOrderPublished(params: { orderId: string; metaCampaignId: string; actorUserId: string; viaLabel: string }) {
  const order = await prisma.trafegoOrder.findUniqueOrThrow({
    where: { id: params.orderId },
    select: { id: true, code: true, status: true, organizationId: true, reviewFingerprint: true },
  });
  if (order.status !== "SCHEDULED" || !order.reviewFingerprint) {
    throw new OrderReviewError(`O pedido ${order.code} não está aprovado para publicar (status ${order.status}).`);
  }
  if (!(await isReleasedByClient(order.id))) {
    throw new OrderReviewError(`O cliente ainda não liberou a publicação do ${order.code}. Não ative a campanha.`);
  }
  if ((await computeOrderFingerprint(order.id)) !== order.reviewFingerprint) {
    throw new OrderReviewError("O pedido mudou depois da aprovação. Pause a campanha na Meta e avalie de novo.");
  }

  const campaignId = params.metaCampaignId.trim();
  const access = await resolveOrderMetaAccess({ organizationId: order.organizationId });
  if (access.mode === "account") {
    const linked = await linkOrderToMetaCampaign({ orderId: order.id, metaCampaignId: campaignId, actorUserId: params.actorUserId, viaLabel: params.viaLabel });
    if (!linked.ok) throw new OrderReviewError(linked.message);
  } else {
    await prisma.$transaction([
      prisma.trafegoOrder.update({ where: { id: order.id }, data: { metaCampaignExternalId: campaignId } }),
      prisma.trafegoOrderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          title: "Campanha vinculada pela equipe",
          detail: `Id ${campaignId} · via IA externa · ${params.viaLabel} · sem conferência (empresa sem Meta nos Satélites)`,
          isClientVisible: false,
          actorUserId: params.actorUserId,
          source: "ADMIN",
        },
      }),
    ]);
  }

  await transitionTrafegoOrder({
    orderId: order.id,
    toStatus: "RUNNING",
    source: "ADMIN",
    actorUserId: params.actorUserId,
    expectedFrom: ["SCHEDULED"],
    title: "Seu anúncio está no ar",
    clientNote: "A equipe publicou a campanha. A Meta ainda revisa o anúncio antes de começar a entregar.",
  });
  return { published: true, orderCode: order.code, campaignId };
}
