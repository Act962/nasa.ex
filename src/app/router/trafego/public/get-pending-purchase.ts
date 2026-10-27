import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { clientIpFromHeaders, takeRateLimit } from "@/lib/rate-limit";

// A tela de sucesso consulta a cada 2 s por até 1 min.
const LOOKUP_LIMIT = { max: 120, windowMs: 10 * 60 * 1000 };

/** `joao@empresa.com` → `j***@empresa.com`: confirma o destino sem expor. */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 1)}***@${domain}`;
}

/**
 * Procedure PÚBLICA — usada por `/trafego/sucesso?token=…` (polling pós-Stripe)
 * e por `/trafego/ativar/[token]`.
 *
 * Aceita o id do pending (que a página de sucesso tem) OU o `signupToken` (que
 * chega no e-mail depois do webhook confirmar).
 *
 * O id do pending é um cuid que circula na URL, não um segredo (P-3). Por ele
 * só sai o e-mail mascarado, e o `signupToken` só quando vem junto o
 * `session_id` do Stripe daquela compra — o que só quem pagou no cartão tem.
 */
export const getPendingTrafegoPurchase = base
  .input(
    z.object({
      pendingId: z.string().min(1).optional(),
      signupToken: z.string().min(1).optional(),
      checkoutSessionId: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const limit = takeRateLimit(
      "trafego-pending-lookup",
      clientIpFromHeaders(context.headers),
      LOOKUP_LIMIT,
    );
    if (!limit.allowed) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: `Muitas consultas. Tente de novo em ${limit.retryAfterSeconds}s.`,
      });
    }

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
        stripeSessionId: true,
        tokenExpiresAt: true,
        paidAt: true,
        plan: { select: { name: true, durationDays: true } },
        order: { select: { id: true, code: true } },
      },
    });

    if (!pending) {
      throw new ORPCError("NOT_FOUND", { message: "Compra não encontrada." });
    }

    const isBuyer =
      Boolean(input.signupToken) ||
      (Boolean(input.checkoutSessionId) &&
        input.checkoutSessionId === pending.stripeSessionId);

    return {
      id: pending.id,
      email: isBuyer ? pending.email : maskEmail(pending.email),
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
      signupToken: isBuyer ? pending.signupToken : null,
      orderId: pending.order?.id ?? null,
      orderCode: pending.order?.code ?? null,
    };
  });
