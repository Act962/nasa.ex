import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

/**
 * Procedure PÚBLICA — usada por `/trafego/sucesso?token=…` (polling pós-Stripe)
 * e por `/trafego/ativar/[token]`.
 *
 * Aceita o id do pending (que a página de sucesso tem) OU o `signupToken` (que
 * chega no e-mail depois do webhook confirmar). Devolve só o necessário pra
 * renderizar — nunca o token de outra pessoa.
 */
export const getPendingTrafegoPurchase = base
  .input(
    z.object({
      pendingId: z.string().min(1).optional(),
      signupToken: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ input }) => {
    if (!input.pendingId && !input.signupToken) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Informe pendingId ou signupToken.",
      });
    }

    const pending = await prisma.trafegoPendingPurchase.findFirst({
      where: input.signupToken
        ? { signupToken: input.signupToken }
        : { id: input.pendingId },
      select: {
        id: true,
        email: true,
        status: true,
        platform: true,
        campaignType: true,
        objective: true,
        adBudgetBrlCents: true,
        serviceFeeBrlCents: true,
        amountBrlCents: true,
        signupToken: true,
        tokenExpiresAt: true,
        paidAt: true,
        plan: { select: { name: true, durationDays: true } },
        order: { select: { id: true, code: true } },
      },
    });

    if (!pending) {
      throw new ORPCError("NOT_FOUND", { message: "Compra não encontrada." });
    }

    // O token só é devolvido pra quem consultou pelo id do próprio pending —
    // é o que a página de sucesso precisa pra montar o link de ativação.
    return {
      id: pending.id,
      email: pending.email,
      status: pending.status,
      platform: pending.platform,
      campaignType: pending.campaignType,
      objective: pending.objective,
      adBudgetBrlCents: pending.adBudgetBrlCents,
      serviceFeeBrlCents: pending.serviceFeeBrlCents,
      amountBrlCents: pending.amountBrlCents,
      planName: pending.plan?.name ?? null,
      durationDays: pending.plan?.durationDays ?? null,
      paidAt: pending.paidAt,
      tokenExpiresAt: pending.tokenExpiresAt,
      signupToken: pending.signupToken,
      orderId: pending.order?.id ?? null,
      orderCode: pending.order?.code ?? null,
    };
  });
