import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { StarTransactionType } from "@/generated/prisma/enums";
import { finalizeStripePurchaseInTx } from "../helpers/purchase-helpers";
import { triggerPurchaseEmail } from "@/features/nasa-route/lib/purchase-email";

const WELCOME_BONUS = 100;

/**
 * Resgate de compra pública de curso (fluxo anônimo via Stripe).
 *
 * Pré-requisito: o usuário JÁ deve ter uma sessão ativa (signed up via
 * `authClient.signUp.email` no client). Esta procedure NÃO cria User —
 * apenas a Organization, o Member, e finaliza a matrícula.
 *
 * Fluxo (pós-mudança Stripe BRL direto):
 *  1. Valida `signupToken` → encontra `PendingCoursePurchase` (status=PAID, não expirado).
 *  2. Confere que o e-mail da sessão === e-mail da compra.
 *  3. Idempotência: se já REDEEMED, retorna o enrollment existente.
 *  4. $transaction:
 *     a. Garante Organization + Member para o user (cria se não existir).
 *     b. Crédita welcome bonus em `starsBonusBalance` para org nova.
 *     c. Finaliza enrollment via `finalizeStripePurchaseInTx`
 *        (sem topup de Stars + sem débito do comprador; o BRL já foi
 *        captado pelo Stripe e o criador recebe Stars como payout interno).
 *     d. Marca pending = REDEEMED.
 *  5. Retorna IDs pra client redirecionar pro player.
 */
export const redeemCoursePurchase = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      signupToken: z.string().min(10),
    }),
  )
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    const userEmail = context.user.email.toLowerCase();

    const pending = await prisma.pendingCoursePurchase.findUnique({
      where: { signupToken: input.signupToken },
      select: {
        id: true,
        email: true,
        status: true,
        priceStars: true,
        amountBrlCents: true,
        stripeSessionId: true,
        stripePaymentIntentId: true,
        tokenExpiresAt: true,
        redeemedEnrollmentId: true,
        course: {
          select: {
            id: true,
            slug: true,
            title: true,
            isPublished: true,
            creatorOrgId: true,
            creatorOrg: { select: { slug: true } },
          },
        },
        plan: { select: { id: true, name: true } },
      },
    });
    if (!pending) {
      throw new ORPCError("NOT_FOUND", {
        message: "Token de resgate inválido.",
      });
    }
    if (pending.email.toLowerCase() !== userEmail) {
      throw new ORPCError("FORBIDDEN", {
        message:
          "Este link de resgate pertence a outro e-mail. Saia e crie uma conta com o e-mail correto.",
      });
    }

    if (pending.status === "REDEEMED") {
      return {
        alreadyRedeemed: true,
        enrollmentId: pending.redeemedEnrollmentId,
        courseId: pending.course.id,
        courseSlug: pending.course.slug,
        companySlug: pending.course.creatorOrg.slug,
      };
    }
    if (pending.status === "EXPIRED") {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Este link expirou. Entre em contato com o suporte para reenviar.",
      });
    }
    if (pending.status !== "PAID") {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Este link ainda não está válido — pagamento não foi confirmado.",
      });
    }
    if (
      pending.tokenExpiresAt &&
      pending.tokenExpiresAt.getTime() < Date.now()
    ) {
      await prisma.pendingCoursePurchase
        .update({ where: { id: pending.id }, data: { status: "EXPIRED" } })
        .catch(() => {});
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Este link expirou. Entre em contato com o suporte para reenviar.",
      });
    }
    if (!pending.course.isPublished) {
      throw new ORPCError("BAD_REQUEST", {
        message: "O curso não está mais disponível. Contate o suporte.",
      });
    }
    if (!pending.plan) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "O plano da compra foi removido. Contate o suporte para refund.",
      });
    }
    if (!pending.stripeSessionId) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Sessão Stripe ausente. Contate o suporte para resgatar a compra.",
      });
    }

    const existingMember = await prisma.member.findFirst({
      where: { userId },
      select: { organizationId: true },
      orderBy: { createdAt: "asc" },
    });

    const result = await prisma.$transaction(async (tx) => {
      // ── Idempotência atômica: claim do PAID → REDEEMED ────────────────
      // Se outra execução concorrente (webhook tardio, retry do client)
      // já tiver movido para REDEEMED, abortamos sem refazer side-effects.
      // O caller acima já tratou o caso "status==='REDEEMED'" pra retornar
      // os dados existentes — aqui é a barreira final contra race.
      const claim = await tx.pendingCoursePurchase.updateMany({
        where: { id: pending.id, status: "PAID" },
        data: { redeemedAt: new Date(), redeemedByUserId: userId },
      });
      if (claim.count === 0) {
        throw new ORPCError("CONFLICT", {
          message:
            "Esta compra já está sendo resgatada em outra sessão. Recarregue a página.",
        });
      }

      // 4a. Garante Organization + Member
      let buyerOrgId = existingMember?.organizationId;
      let isNewOrg = false;
      if (!buyerOrgId) {
        const slug = await generateUniqueOrgSlug(
          tx,
          context.user.name ?? userEmail.split("@")[0] ?? "aluno",
        );
        const org = await tx.organization.create({
          data: {
            name: context.user.name?.trim() || "Minha empresa",
            slug,
            createdAt: new Date(),
            members: {
              create: {
                userId,
                role: "owner",
                createdAt: new Date(),
              },
            },
          },
          select: { id: true },
        });
        buyerOrgId = org.id;
        isNewOrg = true;
      }

      // 4b. Welcome bonus (uma vez por org)
      if (isNewOrg) {
        const txCount = await tx.starTransaction.count({
          where: { organizationId: buyerOrgId },
        });
        if (txCount === 0) {
          const orgRow = await tx.organization.findUniqueOrThrow({
            where: { id: buyerOrgId },
            select: { starsBonusBalance: true, starsBalance: true },
          });
          const newBonus = orgRow.starsBonusBalance + WELCOME_BONUS;
          await tx.organization.update({
            where: { id: buyerOrgId },
            data: { starsBonusBalance: newBonus },
          });
          await tx.starTransaction.create({
            data: {
              organizationId: buyerOrgId,
              type: StarTransactionType.WELCOME_BONUS,
              amount: WELCOME_BONUS,
              balanceAfter: orgRow.starsBalance,
              description: "🎉 Bônus de boas-vindas ao NASA",
            },
          });
        }
      }

      // 4c. Finaliza enrollment via helper Stripe — sem topup nem débito
      // de Stars. O criador recebe payout em Stars como compatibilidade
      // (será migrado para Stripe Connect no próximo passo).
      const purchase = await finalizeStripePurchaseInTx({
        tx: tx as any,
        userId,
        courseId: pending.course.id,
        courseTitle: pending.course.title,
        creatorOrgId: pending.course.creatorOrgId,
        planId: pending.plan!.id,
        planName: pending.plan!.name,
        paidBrlCents: pending.amountBrlCents,
        priceStarsSnapshot: pending.priceStars,
        stripeCheckoutSessionId: pending.stripeSessionId!,
        stripePaymentIntentId: pending.stripePaymentIntentId,
        buyerOrgId,
      });

      await tx.pendingCoursePurchase.update({
        where: { id: pending.id },
        data: {
          status: "REDEEMED",
          redeemedEnrollmentId: purchase.enrollment.id,
        },
      });

      return {
        organizationId: buyerOrgId,
        enrollmentId: purchase.enrollment.id,
      };
    });

    // E-mail de pós-compra (Inngest, fire-and-forget). Disparado fora da
    // transação pra não bloquear o resgate.
    triggerPurchaseEmail(result.enrollmentId);

    return {
      alreadyRedeemed: false,
      enrollmentId: result.enrollmentId,
      organizationId: result.organizationId,
      courseId: pending.course.id,
      courseSlug: pending.course.slug,
      companySlug: pending.course.creatorOrg.slug,
    };
  });

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function generateUniqueOrgSlug(
  tx: { organization: { findUnique: (args: any) => Promise<unknown> } },
  baseName: string,
): Promise<string> {
  const baseSlug = slugify(baseName) || "aluno";
  const candidates = [
    baseSlug,
    `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`,
    `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`,
  ];
  for (const slug of candidates) {
    const existing = await tx.organization.findUnique({
      where: { slug },
      select: { id: true } as never,
    });
    if (!existing) return slug;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}
