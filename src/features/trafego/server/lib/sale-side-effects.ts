import "server-only";
import prisma from "@/lib/prisma";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { PLATFORM_SHORT_LABEL } from "@/features/trafego/lib/catalog-labels";

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
 * Efeitos colaterais da venda do trafeGO: lead no CRM e lançamentos no
 * financeiro. Roda SEMPRE fora da transação do resgate — falhar aqui não pode
 * invalidar um pagamento já confirmado (CLAUDE.md regra 18).
 *
 * Dois lançamentos, porque as parcelas têm naturezas diferentes:
 *  - a taxa de serviço é RECEITA da NASA;
 *  - a verba é REPASSE — entra como despesa a pagar, já que sai para o Meta.
 * Somar as duas num lançamento só inflaria o faturamento.
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
      totalBrlCents: true,
      businessName: true,
    },
  });
  if (!order) return;

  const settings = await prisma.trafegoSettings.findUnique({
    where: { id: "singleton" },
    select: {
      agencyOrganizationId: true,
      salesTrackingId: true,
      salesStatusId: true,
    },
  });

  // Sem org da agência configurada não há onde lançar — o pedido já existe e o
  // admin pode registrar depois. Não é motivo pra falhar.
  if (!settings?.agencyOrganizationId) {
    console.warn(
      `[trafego/side-effects] TrafegoSettings.agencyOrganizationId não configurado — pulando CRM e financeiro do pedido ${order.code}`,
    );
    return;
  }

  const platformLabel = PLATFORM_SHORT_LABEL[order.platform];
  let leadId: string | null = null;

  if (settings.salesTrackingId) {
    try {
      leadId = await createOrActivateLead({
        trackingId: settings.salesTrackingId,
        explicitStatusId: settings.salesStatusId,
        buyer: input.buyer,
        orderLabel: `${order.planNameSnapshot} (${platformLabel})`,
      });
    } catch (error) {
      console.error("[trafego/side-effects] lead falhou:", error);
    }
  }

  try {
    await prisma.paymentEntry.create({
      data: {
        organizationId: settings.agencyOrganizationId,
        type: "RECEIVABLE",
        status: "PAID",
        description: `trafeGO ${order.code} — taxa de serviço (${order.planNameSnapshot})`,
        amount: order.serviceFeeBrlCents,
        paidAmount: order.serviceFeeBrlCents,
        dueDate: new Date(),
        paidAt: new Date(),
        trackingId: settings.salesTrackingId ?? null,
        leadId,
        notes: `Pedido ${order.code} · ${platformLabel} · Total pago ${formatBrlFromCents(order.totalBrlCents)} (verba ${formatBrlFromCents(order.adBudgetBrlCents)} + taxa ${formatBrlFromCents(order.serviceFeeBrlCents)})`,
        createdById: input.buyer.userId,
      },
    });
  } catch (error) {
    console.error("[trafego/side-effects] entry de receita falhou:", error);
  }

  if (order.adBudgetBrlCents > 0) {
    try {
      await prisma.paymentEntry.create({
        data: {
          organizationId: settings.agencyOrganizationId,
          type: "PAYABLE",
          status: "PENDING",
          description: `trafeGO ${order.code} — verba de tráfego a investir (${platformLabel})`,
          amount: order.adBudgetBrlCents,
          paidAmount: 0,
          dueDate: new Date(),
          trackingId: settings.salesTrackingId ?? null,
          leadId,
          notes: `Repasse da verba do pedido ${order.code}${order.businessName ? ` · ${order.businessName}` : ""}`,
          createdById: input.buyer.userId,
        },
      });
    } catch (error) {
      console.error("[trafego/side-effects] entry de repasse falhou:", error);
    }
  }
}

async function createOrActivateLead(args: {
  trackingId: string;
  explicitStatusId: string | null;
  buyer: SaleSideEffectsInput["buyer"];
  orderLabel: string;
}): Promise<string | null> {
  const { trackingId, explicitStatusId, buyer, orderLabel } = args;

  let statusId = explicitStatusId;
  if (!statusId) {
    const firstStatus = await prisma.status.findFirst({
      where: { trackingId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    if (!firstStatus) {
      console.warn(
        `[trafego/side-effects] tracking ${trackingId} sem colunas — lead ignorado`,
      );
      return null;
    }
    statusId = firstStatus.id;
  }

  const identityFilters = [
    buyer.email ? { email: buyer.email } : null,
    buyer.phone ? { phone: buyer.phone } : null,
  ].filter((filter): filter is { email: string } | { phone: string } =>
    Boolean(filter),
  );

  if (identityFilters.length > 0) {
    const existing = await prisma.lead.findFirst({
      where: { trackingId, OR: identityFilters },
      select: { id: true },
    });
    if (existing) {
      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          statusId,
          statusEnteredAt: new Date(),
          currentAction: "ACTIVE",
        },
      });
      return existing.id;
    }
  }

  const lead = await prisma.lead.create({
    data: {
      trackingId,
      statusId,
      name: buyer.name ?? buyer.email ?? "Cliente trafeGO",
      email: buyer.email ?? null,
      phone: buyer.phone ?? null,
      description: `Contratou: ${orderLabel}`,
      statusEnteredAt: new Date(),
      currentAction: "ACTIVE",
    },
    select: { id: true },
  });
  return lead.id;
}
