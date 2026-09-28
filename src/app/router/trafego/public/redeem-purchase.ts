import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { createTrafegoOrderFromPurchaseInTx } from "@/features/trafego/server/lib/create-order-from-purchase";
import { runTrafegoOrderPostCreation } from "@/features/trafego/server/lib/create-order-and-side-effects";

/**
 * Resgate da compra pública do trafeGO.
 *
 * Pré-requisito: o usuário JÁ tem sessão (o client roda `authClient.signUp.email`
 * antes). Esta procedure não cria `User` — cria Organization, Member e o pedido.
 *
 * Fluxo:
 *  1. Valida token, dono do e-mail, status PAID e expiração.
 *  2. Se já REDEEMED, devolve o pedido existente (idempotência de leitura).
 *  3. $transaction (só escritas de banco — CLAUDE.md regra 18):
 *     a. Claim atômico PAID → redeemedAt/redeemedByUserId.
 *     b. Reusa a org mais antiga do usuário; se não houver, cria uma nova com
 *        `appScope="trafego"`.
 *     c. Cria o TrafegoOrder a partir do snapshot da compra.
 *     d. Semeia a sidebar (app + app inicial) e fecha o onboarding da plataforma.
 *     e. Marca a compra como REDEEMED.
 *  4. Fora da transação, best-effort: card, briefing, financeiro e aviso
 *     (`runTrafegoOrderPostCreation` — o mesmo dos outros caminhos de pagamento).
 */
export const redeemTrafegoPurchase = base
  .use(requiredAuthMiddleware)
  .input(z.object({ signupToken: z.string().min(10) }))
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    const userEmail = context.user.email.toLowerCase();

    const pending = await prisma.trafegoPendingPurchase.findUnique({
      where: { signupToken: input.signupToken },
      select: {
        id: true,
        email: true,
        status: true,
        companyName: true,
        tokenExpiresAt: true,
        planId: true,
        order: { select: { id: true, code: true, organizationId: true } },
      },
    });

    if (!pending) {
      throw new ORPCError("NOT_FOUND", { message: "Link de ativação inválido." });
    }
    if (pending.email.toLowerCase() !== userEmail) {
      throw new ORPCError("FORBIDDEN", {
        message:
          "Este link pertence a outro e-mail. Saia da conta atual e entre com o e-mail da compra.",
      });
    }
    if (pending.status === "REDEEMED" && pending.order) {
      return {
        alreadyRedeemed: true,
        organizationId: pending.order.organizationId,
        orderId: pending.order.id,
        orderCode: pending.order.code,
      };
    }
    if (pending.status === "EXPIRED") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Este link expirou. Fale com o suporte para reenviarmos o acesso.",
      });
    }
    if (pending.status !== "PAID") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Pagamento ainda não confirmado. Aguarde alguns instantes.",
      });
    }
    if (pending.tokenExpiresAt && pending.tokenExpiresAt.getTime() < Date.now()) {
      await prisma.trafegoPendingPurchase
        .update({ where: { id: pending.id }, data: { status: "EXPIRED" } })
        .catch(() => {});
      throw new ORPCError("BAD_REQUEST", {
        message: "Este link expirou. Fale com o suporte para reenviarmos o acesso.",
      });
    }

    const existingMember = await prisma.member.findFirst({
      where: { userId },
      select: { organizationId: true },
      orderBy: { createdAt: "asc" },
    });

    const result = await prisma.$transaction(async (tx) => {
      // Barreira final contra resgate concorrente (duas abas, retry do client).
      const claim = await tx.trafegoPendingPurchase.updateMany({
        where: { id: pending.id, status: "PAID" },
        data: { redeemedAt: new Date(), redeemedByUserId: userId },
      });
      if (claim.count === 0) {
        throw new ORPCError("CONFLICT", {
          message: "Esta compra já está sendo ativada em outra aba. Recarregue a página.",
        });
      }

      let organizationId = existingMember?.organizationId;
      let isNewOrg = false;

      if (!organizationId) {
        const baseName =
          pending.companyName?.trim() ||
          context.user.name?.trim() ||
          userEmail.split("@")[0] ||
          "cliente";
        const slug = await generateUniqueOrgSlug(tx, baseName);
        const org = await tx.organization.create({
          data: {
            name: baseName.slice(0, 80),
            slug,
            createdAt: new Date(),
            // Só a org NASCIDA aqui fica restrita. Cliente que já tinha conta
            // mantém a plataforma completa.
            appScope: "trafego",
            members: { create: { userId, role: "owner", createdAt: new Date() } },
          },
          select: { id: true },
        });
        organizationId = org.id;
        isNewOrg = true;
      }

      const order = await createTrafegoOrderFromPurchaseInTx({
        tx,
        pendingPurchaseId: pending.id,
        organizationId,
        ownerUserId: userId,
      });

      await tx.trafegoPendingPurchase.update({
        where: { id: pending.id },
        data: { status: "REDEEMED" },
      });

      if (isNewOrg) {
        // Deixa o trafeGO visível na sidebar. O redirect de `/home` pro painel
        // é feito pelo guard de escopo em (tracking)/layout.tsx.
        await tx.userSidebarPreference.createMany({
          data: [{ userId, itemKey: "app:trafego", visible: true }],
          skipDuplicates: true,
        });
        // Sem isto o OnboardingGate abre o wizard de CRM da plataforma inteira
        // na cara de quem acabou de comprar uma campanha.
        await tx.user.updateMany({
          where: { id: userId, onboardingCompletedAt: null },
          data: { onboardingCompletedAt: new Date() },
        });
      }

      return {
        organizationId,
        orderId: order.id,
        orderCode: order.code,
        isNewOrg,
      };
    });

    // Efeitos colaterais ficam fora da transação: falha aqui não pode invalidar
    // um pagamento já confirmado (CLAUDE.md regra 18).
    runTrafegoOrderPostCreation({
      orderId: result.orderId,
      buyer: {
        userId,
        name: context.user.name,
        email: userEmail,
        phone: context.user.phone ?? null,
      },
    }).catch((error) =>
      console.error("[trafego/redeem] side-effects falharam:", error),
    );

    return {
      alreadyRedeemed: false,
      organizationId: result.organizationId,
      orderId: result.orderId,
      orderCode: result.orderCode,
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
  tx: { organization: { findUnique: (args: never) => Promise<unknown> } },
  baseName: string,
): Promise<string> {
  const baseSlug = slugify(baseName) || "cliente";
  const candidates = [
    baseSlug,
    `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`,
    `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`,
  ];
  for (const slug of candidates) {
    const existing = await tx.organization.findUnique({
      where: { slug },
      select: { id: true },
    } as never);
    if (!existing) return slug;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}
