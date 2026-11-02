import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { OrderReviewError } from "@/features/trafego/server/lib/order-review";
import { applyOrderReviewFixes } from "@/features/trafego/server/lib/order-review-actions";

/**
 * O cliente aprova a recomendação da equipe (spec 0130, RF-9, D-4): a aprovação autoriza a equipe
 * a seguir com a publicação e fica registrada no histórico. Só dono ou admin da org do pedido.
 */

const APPROVER_ROLES = new Set(["owner", "admin"]);

export const approveTrafegoRecommendation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ eventId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const event = await prisma.trafegoOrderEvent.findFirst({
      // Escopo pela org de quem aprova (CA-9): id de outra org não é encontrado.
      where: { id: input.eventId, requiresApproval: true, order: { organizationId: context.org.id } },
      select: { id: true, orderId: true, order: { select: { status: true, reviewFingerprint: true } } },
    });
    if (!event) throw new ORPCError("NOT_FOUND", { message: "Recomendação não encontrada." });
    // Avaliação com ajustes não se aprova direto: as melhorias passam pelo "Avaliar melhorias e aprovar" (spec 0132, RF-5).
    if (event.order.status === "CHANGES_REQUESTED" && event.order.reviewFingerprint) {
      throw new ORPCError("BAD_REQUEST", { message: 'A equipe pediu ajustes. Use "Avaliar melhorias e aprovar".' });
    }

    const member = await prisma.member.findFirst({
      where: { userId: context.user.id, organizationId: context.org.id },
      select: { role: true },
    });
    if (!member || !APPROVER_ROLES.has(member.role)) {
      throw new ORPCError("FORBIDDEN", { message: "Só o dono ou um admin da empresa pode aprovar." });
    }

    const now = new Date();
    const isApproved = await prisma.$transaction(async (tx) => {
      // Só grava se ainda está pendente: dois cliques ou duas abas não aprovam duas vezes (CB-5).
      const { count } = await tx.trafegoOrderEvent.updateMany({
        where: { id: event.id, approvedAt: null, supersededAt: null },
        data: { approvedAt: now, approvedByUserId: context.user.id },
      });
      if (count === 0) return false;
      await tx.trafegoOrderEvent.create({
        data: {
          orderId: event.orderId,
          fromStatus: event.order.status,
          toStatus: event.order.status,
          title: "Cliente aprovou a recomendação da equipe",
          detail: `Aprovado por ${context.user.name}. A equipe está autorizada a seguir com a publicação.`,
          isClientVisible: true,
          actorUserId: context.user.id,
          source: "CLIENT",
        },
      });
      return true;
    });

    return { isApproved };
  });

/** Quem pode aprovar no painel (spec 0130, CA-8): o botão só aparece para dono e admin. */
export const getTrafegoApprovalPermission = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const member = await prisma.member.findFirst({
      where: { userId: context.user.id, organizationId: context.org.id },
      select: { role: true },
    });
    return { canApprove: Boolean(member && APPROVER_ROLES.has(member.role)) };
  });

/**
 * "Avaliar melhorias e aprovar" (spec 0132, RF-5): grava as melhorias guardadas pela avaliação do Claude.
 * Só dono ou admin da org do pedido; o pedido é procurado pela org da sessão.
 */
export const applyTrafegoReviewFixes = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const member = await prisma.member.findFirst({
      where: { userId: context.user.id, organizationId: context.org.id },
      select: { role: true },
    });
    if (!member || !APPROVER_ROLES.has(member.role)) {
      throw new ORPCError("FORBIDDEN", { message: "Só o dono ou um admin da empresa pode aprovar." });
    }
    try {
      return await applyOrderReviewFixes({
        orderId: input.orderId,
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
      });
    } catch (error) {
      if (error instanceof OrderReviewError) throw new ORPCError("BAD_REQUEST", { message: error.message });
      throw error;
    }
  });
