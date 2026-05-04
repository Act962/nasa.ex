import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

/**
 * Procedure PÚBLICA — usada pelas páginas `/resgatar/[token]` e
 * `/checkout/sucesso?token=…` pra recuperar o estado da compra pública de
 * curso (`PendingCoursePurchase`).
 *
 * Aceita ID do pending OU `signupToken` (gerado no webhook do Stripe quando
 * o pagamento é confirmado). A página de sucesso passa o `pendingId` (ainda
 * não tem token), e a página de resgate passa o `signupToken` do e-mail.
 *
 * Retorna o status atual + dados do curso/plano. NÃO retorna o token nem o
 * email completo de outras pessoas — apenas o suficiente pra renderizar.
 */
export const getPendingPurchase = base
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

    const pending = await prisma.pendingCoursePurchase.findFirst({
      where: input.signupToken
        ? { signupToken: input.signupToken }
        : { id: input.pendingId },
      select: {
        id: true,
        email: true,
        status: true,
        priceStars: true,
        amountBrlCents: true,
        tokenExpiresAt: true,
        paidAt: true,
        createdAt: true,
        course: {
          select: {
            id: true,
            slug: true,
            title: true,
            coverUrl: true,
            creatorOrg: { select: { name: true, slug: true } },
          },
        },
        plan: { select: { id: true, name: true } },
      },
    });

    if (!pending) {
      throw new ORPCError("NOT_FOUND", { message: "Compra não encontrada." });
    }

    // Token vencido? Marca como EXPIRED de forma idempotente.
    let status = pending.status;
    if (
      status === "PAID" &&
      pending.tokenExpiresAt &&
      pending.tokenExpiresAt.getTime() < Date.now()
    ) {
      try {
        await prisma.pendingCoursePurchase.update({
          where: { id: pending.id },
          data: { status: "EXPIRED" },
        });
        status = "EXPIRED";
      } catch (err) {
        console.error("[getPendingPurchase] auto-expire failed:", err);
      }
    }

    return {
      id: pending.id,
      email: pending.email,
      status,
      priceStars: pending.priceStars,
      amountBrl: pending.amountBrlCents / 100,
      tokenExpiresAt: pending.tokenExpiresAt,
      paidAt: pending.paidAt,
      createdAt: pending.createdAt,
      course: {
        id: pending.course.id,
        slug: pending.course.slug,
        title: pending.course.title,
        coverUrl: pending.course.coverUrl,
        creatorOrg: pending.course.creatorOrg,
      },
      plan: pending.plan,
    };
  });
