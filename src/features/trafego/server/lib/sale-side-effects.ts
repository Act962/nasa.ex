import "server-only";
import prisma from "@/lib/prisma";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { PLATFORM_SHORT_LABEL } from "@/features/trafego/lib/catalog-labels";
import { allocateTrafegoDiscount } from "@/features/trafego/lib/pricing-tiers";
import { loadTrafegoSettings } from "./trafego-settings";
import { fetchTrafegoStripeDiscountCents } from "./stripe-discount";
import { notifyTrafegoAdmins, recordTrafegoInternalEvent } from "./trafego-alerts";

interface SaleSideEffectsInput {
  orderId: string;
  buyer: {
    userId: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

/**
 * Lançamentos financeiros da venda na org da agência. Roda SEMPRE fora da
 * transação do resgate — falhar aqui não pode invalidar um pagamento já
 * confirmado (CLAUDE.md regra 18).
 *
 * Dois lançamentos, porque as parcelas têm naturezas diferentes:
 *  - taxa de serviço + setup + criativos extras são RECEITA (spec 0009 D-5);
 *  - a verba é REPASSE — entra como despesa a pagar, já que sai para a plataforma.
 * Somar as duas num lançamento só inflaria o faturamento.
 *
 * Valores líquidos do cupom: o desconto é lido do Stripe e distribuído por
 * `allocateTrafegoDiscount` (P-9). Sem isso, um cupom de 100% lançava a venda
 * cheia como recebida.
 *
 * Idempotente por (org, tipo, documentNumber = código do pedido): os três
 * caminhos de pagamento (público, autenticado, PIX) chamam isto sem medo.
 * O card no CRM não é criado aqui — ver `ensure-trafego-lead.ts`.
 */
export async function createTrafegoSaleSideEffects(
  input: SaleSideEffectsInput,
): Promise<void> {
  const order = await prisma.trafegoOrder.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      code: true,
      platform: true,
      planNameSnapshot: true,
      adBudgetBrlCents: true,
      serviceFeeBrlCents: true,
      setupFeeBrlCents: true,
      totalBrlCents: true,
      businessName: true,
      leadId: true,
      stripeSessionId: true,
      stripePaymentIntentId: true,
    },
  });
  if (!order) return;

  const settings = await loadTrafegoSettings({ fresh: true });

  // Sem org da agência configurada não há onde lançar — o pedido já existe e o
  // admin pode registrar depois. Não é motivo pra falhar.
  if (!settings.agencyOrganizationId) {
    console.warn(
      `[trafego/side-effects] TrafegoSettings.agencyOrganizationId não configurado — pulando financeiro do pedido ${order.code}`,
    );
    return;
  }

  const discountBrlCents = await fetchTrafegoStripeDiscountCents({
    checkoutSessionId: order.stripeSessionId,
    paymentIntentId: order.stripePaymentIntentId,
  });
  // Sem saber o desconto, lançar o contratado poderia registrar dinheiro que
  // não entrou. Melhor não lançar e pedir conferência.
  if (discountBrlCents === null) {
    await notifyTrafegoAdmins({
      title: `trafeGO ${order.code}: financeiro não lançado`,
      body: "Não foi possível ler o desconto do Stripe. Lance a venda à mão depois de conferir o valor pago.",
    });
    return;
  }

  // Criativos extras não têm coluna própria no pedido: são o que sobra do total.
  const extraCreativesBrlCents = Math.max(
    0,
    order.totalBrlCents -
      order.adBudgetBrlCents -
      order.serviceFeeBrlCents -
      order.setupFeeBrlCents,
  );
  const net = allocateTrafegoDiscount(
    {
      serviceFeeBrlCents: order.serviceFeeBrlCents,
      setupBrlCents: order.setupFeeBrlCents,
      extraCreativesBrlCents,
      adBudgetBrlCents: order.adBudgetBrlCents,
    },
    discountBrlCents,
  );

  if (net.touchesAdBudget) {
    const detail = `O cupom de ${formatBrlFromCents(net.discountBrlCents)} reduziu a verba de ${formatBrlFromCents(order.adBudgetBrlCents)} para ${formatBrlFromCents(net.adBudgetBrlCents)}.`;
    await recordTrafegoInternalEvent({
      orderId: order.id,
      title: "Cupom atingiu a verba",
      detail,
    });
    await notifyTrafegoAdmins({
      title: `trafeGO ${order.code}: cupom atingiu a verba`,
      body: `${detail} Confira o que vai ser investido no anúncio.`,
      actionUrl: `/admin/trafego/${order.id}`,
    });
  }

  const organizationId = settings.agencyOrganizationId;
  const trackingId = settings.operationsTrackingId ?? settings.salesTrackingId ?? null;
  const platformLabel = PLATFORM_SHORT_LABEL[order.platform];
  const now = new Date();
  const revenueBrlCents =
    net.serviceFeeBrlCents + net.setupBrlCents + net.extraCreativesBrlCents;
  const discountNote =
    net.discountBrlCents > 0 ? ` · cupom ${formatBrlFromCents(net.discountBrlCents)}` : "";

  const revenueExists = await prisma.paymentEntry.count({
    where: { organizationId, type: "RECEIVABLE", documentNumber: order.code },
  });
  if (revenueExists === 0 && revenueBrlCents > 0) {
    try {
      await prisma.paymentEntry.create({
        data: {
          organizationId,
          type: "RECEIVABLE",
          status: "PAID",
          description: `trafeGO ${order.code} — taxa de serviço${order.setupFeeBrlCents > 0 ? " + setup" : ""}${extraCreativesBrlCents > 0 ? " + criativos extras" : ""} (${order.planNameSnapshot})`,
          amount: revenueBrlCents,
          paidAmount: revenueBrlCents,
          dueDate: now,
          paidAt: now,
          competenceDate: now,
          documentNumber: order.code,
          accountId: settings.financeAccountId ?? undefined,
          categoryId: settings.financeRevenueCategoryId ?? undefined,
          trackingId,
          leadId: order.leadId,
          notes: `Pedido ${order.code} · ${platformLabel} · Total contratado ${formatBrlFromCents(order.totalBrlCents)} (verba ${formatBrlFromCents(order.adBudgetBrlCents)} + taxa ${formatBrlFromCents(order.serviceFeeBrlCents)}${order.setupFeeBrlCents > 0 ? ` + setup ${formatBrlFromCents(order.setupFeeBrlCents)}` : ""}${extraCreativesBrlCents > 0 ? ` + extras ${formatBrlFromCents(extraCreativesBrlCents)}` : ""})${discountNote}`,
          createdById: input.buyer.userId,
        },
      });
    } catch (error) {
      console.error("[trafego/side-effects] entry de receita falhou:", error);
    }
  }

  const passthroughExists = await prisma.paymentEntry.count({
    where: { organizationId, type: "PAYABLE", documentNumber: order.code },
  });
  if (passthroughExists === 0 && net.adBudgetBrlCents > 0) {
    try {
      await prisma.paymentEntry.create({
        data: {
          organizationId,
          type: "PAYABLE",
          status: "PENDING",
          description: `trafeGO ${order.code} — verba de tráfego a investir (${platformLabel})`,
          amount: net.adBudgetBrlCents,
          paidAmount: 0,
          dueDate: now,
          competenceDate: now,
          documentNumber: order.code,
          accountId: settings.financeAccountId ?? undefined,
          categoryId: settings.financePassthroughCategoryId ?? undefined,
          trackingId,
          leadId: order.leadId,
          notes: `Repasse da verba do pedido ${order.code}${order.businessName ? ` · ${order.businessName}` : ""}${discountNote}`,
          createdById: input.buyer.userId,
        },
      });
    } catch (error) {
      console.error("[trafego/side-effects] entry de repasse falhou:", error);
    }
  }
}
