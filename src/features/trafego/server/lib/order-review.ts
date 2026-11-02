import "server-only";

import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { trafegoCreativeDraftSchema } from "@/features/trafego/lib/creative-review/schema";
import {
  REVIEW_SLA_HOURS,
  buildOrderFingerprintSource,
  describeReviewFixes,
  isReadyToPublish,
  orderReviewFixesSchema,
  type OrderReviewFixes,
} from "@/features/trafego/lib/order-review";
import { normalizeOrderCode } from "@/features/trafego/lib/team-actions";
import { transitionTrafegoOrder } from "./transition-order";

/**
 * Avaliação do Claude no pedido antes de publicar (spec 0132). O pedido é o rascunho (D-1); os status já
 * existentes dizem onde ele está (D-2) e o resultado é a recomendação da 0130 (D-3). Quem chama confere a
 * permissão; nada aqui chama a Meta.
 */

export class OrderReviewError extends Error {}

export function isOrderReviewEnabled(): boolean {
  return process.env.TRAFEGO_CAMPAIGN_REVIEW === "true";
}

const FINGERPRINT_SELECT = {
  adBudgetBrlCents: true,
  durationDays: true,
  desiredStartAt: true,
  targetAudience: true,
  pendingPurchase: { select: { briefing: true } },
  creatives: { select: { id: true, fileKey: true, status: true } },
  copies: { select: { id: true, primaryText: true, headline: true, isSelected: true } },
} as const;

export function readInitialMessage(briefing: unknown): string | null {
  const draft = trafegoCreativeDraftSchema.safeParse(((briefing ?? {}) as Record<string, unknown>).creativeDraft);
  return draft.success ? (draft.data.initialMessage ?? null) : null;
}

export async function computeOrderFingerprint(orderId: string): Promise<string> {
  const order = await prisma.trafegoOrder.findUniqueOrThrow({ where: { id: orderId }, select: FINGERPRINT_SELECT });
  const source = buildOrderFingerprintSource({
    ...order,
    initialMessage: readInitialMessage(order.pendingPurchase?.briefing),
  });
  return createHash("sha256").update(source).digest("hex").slice(0, 32);
}

/** Pedido completo entra na fila (RF-1). Chamado depois de o pedido chegar a "Materiais enviados". */
export async function enqueueOrderReview(orderId: string) {
  if (!isOrderReviewEnabled()) return;
  const result = await transitionTrafegoOrder({
    orderId,
    toStatus: "IN_REVIEW",
    source: "SYSTEM",
    expectedFrom: ["MATERIALS_SUBMITTED"],
    title: "Seu anúncio está na avaliação da equipe",
    clientNote: `A equipe avalia seu anúncio em até ${REVIEW_SLA_HOURS} horas. Você recebe um aviso quando terminar.`,
  });
  if (!result.changed) return;
  await prisma.trafegoOrder.update({
    where: { id: orderId },
    data: { reviewRequestedAt: new Date(), reviewFingerprint: null, reviewFixes: Prisma.DbNull, reviewNotes: [] },
  });
}

export async function findOrderIdByCode(code: string): Promise<string> {
  const order = await prisma.trafegoOrder.findUnique({ where: { code: normalizeOrderCode(code) }, select: { id: true } });
  if (!order) throw new OrderReviewError(`Pedido ${normalizeOrderCode(code)} não encontrado.`);
  return order.id;
}

/** O cliente liberou = a última avaliação (recomendação) está aprovada (D-3). */
export async function isReleasedByClient(orderId: string): Promise<boolean> {
  const latest = await prisma.trafegoOrderEvent.findFirst({
    where: { orderId, requiresApproval: true, supersededAt: null },
    orderBy: { createdAt: "desc" },
    select: { approvedAt: true },
  });
  return Boolean(latest?.approvedAt);
}

/** Fila da rotina (RF-7): para avaliar e para publicar, mais antigos primeiro. */
export async function listOrderReviewQueue(limit: number) {
  const orderSelect = {
    id: true,
    code: true,
    status: true,
    reviewRequestedAt: true,
    reviewFingerprint: true,
    metaCampaignExternalId: true,
    desiredStartAt: true,
    businessName: true,
    organization: { select: { name: true } },
  } as const;
  const [toReview, scheduled] = await Promise.all([
    prisma.trafegoOrder.findMany({
      where: { status: "IN_REVIEW", reviewRequestedAt: { not: null } },
      orderBy: { reviewRequestedAt: "asc" },
      take: limit,
      select: orderSelect,
    }),
    prisma.trafegoOrder.findMany({
      where: { status: "SCHEDULED", reviewFingerprint: { not: null }, metaCampaignExternalId: null },
      orderBy: { updatedAt: "asc" },
      take: limit,
      select: orderSelect,
    }),
  ]);

  const toPublish = [];
  for (const order of scheduled) {
    const isReleased = await isReleasedByClient(order.id);
    const isReady = isReadyToPublish({
      status: order.status,
      hasReviewFingerprint: true,
      isReleasedByClient: isReleased,
      hasLinkedCampaign: false,
      desiredStartAt: order.desiredStartAt,
    });
    if (isReady) toPublish.push(order);
  }

  const hoursSince = (date: Date | null) => (date ? Math.floor((Date.now() - date.getTime()) / 3_600_000) : null);
  return {
    toReview: toReview.map((order) => ({
      code: order.code,
      company: order.organization.name,
      business: order.businessName,
      waitingHours: hoursSince(order.reviewRequestedAt),
    })),
    toPublish: toPublish.map((order) => ({ code: order.code, company: order.organization.name, business: order.businessName })),
  };
}

/**
 * Grava a avaliação (RF-3, RF-7, RF-9). `fingerprint` ausente = aprovação à mão do admin, sobre a versão
 * atual. Versão velha é recusada (CA-7). O aviso ao cliente sai pela transição de status.
 */
export async function recordOrderReview(params: {
  orderId: string;
  fingerprint?: string;
  verdict: "approved" | "changes";
  summary: string;
  fixes?: OrderReviewFixes;
  notes?: string[];
  actorUserId: string;
  viaLabel?: string;
}) {
  const order = await prisma.trafegoOrder.findUniqueOrThrow({
    where: { id: params.orderId },
    select: {
      id: true,
      code: true,
      status: true,
      pendingPurchaseId: true,
      copies: { where: { isSelected: true }, select: { id: true }, take: 1 },
    },
  });
  if (order.status !== "IN_REVIEW") {
    throw new OrderReviewError(`O pedido ${order.code} não está esperando avaliação (status ${order.status}).`);
  }
  const currentFingerprint = await computeOrderFingerprint(order.id);
  if (params.fingerprint && params.fingerprint !== currentFingerprint) {
    throw new OrderReviewError("O cliente mudou o pedido depois da sua leitura. Leia de novo com trafego_get_order_for_review.");
  }

  const isApproved = params.verdict === "approved";
  const fixes = !isApproved && params.fixes ? orderReviewFixesSchema.parse(params.fixes) : null;
  const notes = isApproved ? [] : (params.notes ?? []).map((note) => note.trim()).filter(Boolean).slice(0, 10);
  if (!isApproved && !fixes && notes.length === 0) {
    throw new OrderReviewError("Ajustes exigem fixes ou notes: diga ao cliente o que melhorar.");
  }
  if (fixes?.initialMessage && !order.pendingPurchaseId) {
    throw new OrderReviewError("Este pedido não tem mensagem inicial guardada no ÓRBITA. Use notes para pedir a mudança.");
  }
  if ((fixes?.message || fixes?.headline) && order.copies.length === 0) {
    throw new OrderReviewError("O pedido não tem texto escolhido para corrigir. Use notes.");
  }

  const transition = await transitionTrafegoOrder({
    orderId: order.id,
    toStatus: isApproved ? "SCHEDULED" : "CHANGES_REQUESTED",
    source: "ADMIN",
    actorUserId: params.actorUserId,
    expectedFrom: ["IN_REVIEW"],
    title: isApproved ? "Seu anúncio foi aprovado pela equipe" : "Seu anúncio precisa de ajustes antes de publicar",
    clientNote: isApproved
      ? 'Toque em "Aprovado, publicar" no painel para a equipe colocar no ar.'
      : 'Veja as melhorias no painel e toque em "Avaliar melhorias e aprovar".',
    internalNote: params.viaLabel ? `Avaliação via IA externa · ${params.viaLabel}` : null,
  });
  if (!transition.changed) throw new OrderReviewError("O pedido mudou de status enquanto você avaliava. Leia a fila de novo.");

  const improvements = [...(fixes ? describeReviewFixes(fixes) : []), ...notes];
  const now = new Date();
  await prisma.$transaction([
    prisma.trafegoOrder.update({
      where: { id: order.id },
      data: { reviewFingerprint: currentFingerprint, reviewFixes: fixes ?? Prisma.DbNull, reviewNotes: notes },
    }),
    prisma.trafegoOrderEvent.updateMany({
      where: { orderId: order.id, requiresApproval: true, approvedAt: null, supersededAt: null },
      data: { supersededAt: now },
    }),
    prisma.trafegoOrderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: "IN_REVIEW",
        toStatus: isApproved ? "SCHEDULED" : "CHANGES_REQUESTED",
        title: isApproved ? "Anúncio aprovado — falta você liberar a publicação" : "A equipe pediu ajustes no anúncio",
        detail: [params.summary.trim(), ...improvements.map((item) => `• ${item}`)].join("\n"),
        isClientVisible: true,
        actorUserId: params.actorUserId,
        source: "ADMIN",
        requiresApproval: true,
      },
    }),
  ]);
  return { verdict: params.verdict, orderCode: order.code };
}
