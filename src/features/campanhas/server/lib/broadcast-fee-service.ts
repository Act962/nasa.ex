// Cotação, cobrança e liberação da taxa ÓRBITA por campanha (spec 0040, RF-6/RF-7).
// Valores sempre recalculados aqui — o navegador só escolhe a forma de pagar.

import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { createCharge, dueDatePlus, findOrCreateCustomer, getPayment } from "@/lib/asaas";
import { inngest } from "@/inngest/client";
import { loadTrafegoAsaasGateway } from "@/features/trafego/server/lib/asaas-gateway";
import { isValidBrazilianDocument } from "@/features/payment/lib/documents/normalize-document";
import { estimateMetaCost, metaPriceTable, type TemplateCategory } from "@/features/campanhas/lib/meta-pricing";
import {
  DEFAULT_BROADCAST_FEE_TIERS,
  DEFAULT_MIN_BROADCAST_FEE_BRL_CENTS,
  quoteBroadcastFee,
  type BroadcastFeeTier,
} from "@/features/campanhas/lib/broadcast-fee";
import {
  howToReachNextLevel,
  nextMessagingLimit,
  planDailyBatches,
  type MessagingLimitLevel,
} from "@/features/campanhas/lib/messaging-limits";
import { resolveCampaignMetaCredentials } from "./broadcast-access";
import { resolveNumberMessagingLimit } from "./daily-quota";
import { beginBroadcastDispatch } from "./begin-broadcast-dispatch";

const DAY_MS = 24 * 60 * 60_000;
const STRIPE_MIN_BRL_CENTS = 50;

export interface BroadcastFeeSettingsValue {
  enabled: boolean;
  tiers: BroadcastFeeTier[];
  minFeeBrlCents: number;
}

function parseTiers(raw: unknown): BroadcastFeeTier[] {
  if (!Array.isArray(raw)) return DEFAULT_BROADCAST_FEE_TIERS;
  const tiers = raw.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { minMetaCostBrlCents, feePercent } = entry as Record<string, unknown>;
    if (typeof minMetaCostBrlCents !== "number" || typeof feePercent !== "number") return [];
    return [{ minMetaCostBrlCents, feePercent }];
  });
  return tiers.length ? tiers : DEFAULT_BROADCAST_FEE_TIERS;
}

export async function loadBroadcastFeeSettings(): Promise<BroadcastFeeSettingsValue> {
  const settings = await prisma.broadcastFeeSettings.findUnique({ where: { id: "default" } });
  return {
    enabled: settings?.enabled ?? false,
    tiers: parseTiers(settings?.tiers),
    minFeeBrlCents: settings?.minFeeBrlCents ?? DEFAULT_MIN_BROADCAST_FEE_BRL_CENTS,
  };
}

function toTemplateCategory(category: string | null): TemplateCategory {
  const normalized = (category ?? "").toUpperCase();
  return normalized === "UTILITY" || normalized === "AUTHENTICATION" ? normalized : "MARKETING";
}

/** Destinatários pendentes que escreveram para a empresa nas últimas 24h (janela aberta). */
async function countOpenWindowRecipients(broadcastId: string, now: Date): Promise<number> {
  const pendingLeads = await prisma.broadcastRecipient.findMany({
    where: { broadcastId, status: "PENDING", leadId: { not: null } },
    select: { leadId: true },
  });
  const leadIds = pendingLeads.flatMap((recipient) => (recipient.leadId ? [recipient.leadId] : []));
  if (!leadIds.length) return 0;
  return prisma.conversation.count({
    where: {
      leadId: { in: leadIds },
      messages: { some: { fromMe: false, createdAt: { gte: new Date(now.getTime() - DAY_MS) } } },
    },
  });
}

export interface BroadcastQuote {
  isFeeEnabled: boolean;
  recipients: number;
  openWindowRecipients: number;
  category: TemplateCategory;
  metaCost: ReturnType<typeof estimateMetaCost>;
  utilityAlternativeBrlCents: number;
  fee: ReturnType<typeof quoteBroadcastFee>;
  limit: MessagingLimitLevel;
  nextLimit: MessagingLimitLevel | null;
  howToReachNextLimit: string | null;
  batches: { days: number; perDay: number[] };
}

interface QuotableBroadcast {
  id: string;
  trackingId: string;
  templateCategory: string | null;
}

export async function buildBroadcastQuote(broadcast: QuotableBroadcast, organizationId: string): Promise<BroadcastQuote> {
  const now = new Date();
  const [recipients, openWindowRecipients, settings, credentials] = await Promise.all([
    prisma.broadcastRecipient.count({ where: { broadcastId: broadcast.id, status: "PENDING" } }),
    countOpenWindowRecipients(broadcast.id, now),
    loadBroadcastFeeSettings(),
    resolveCampaignMetaCredentials(broadcast.trackingId, organizationId),
  ]);
  const limit = await resolveNumberMessagingLimit(credentials);
  const table = metaPriceTable(process.env);
  const category = toTemplateCategory(broadcast.templateCategory);
  const metaCost = estimateMetaCost({ recipients, category, openWindowRecipients, now, table });
  const utilityAlternative = estimateMetaCost({ recipients, category: "UTILITY", openWindowRecipients, now, table });
  return {
    isFeeEnabled: settings.enabled,
    recipients,
    openWindowRecipients,
    category,
    metaCost,
    utilityAlternativeBrlCents: utilityAlternative.totalBrlCents,
    fee: quoteBroadcastFee({
      metaCostBrlCents: metaCost.totalBrlCents,
      tiers: settings.tiers,
      minFeeBrlCents: settings.minFeeBrlCents,
    }),
    limit,
    nextLimit: nextMessagingLimit(limit),
    howToReachNextLimit: howToReachNextLevel(limit),
    batches: planDailyBatches(recipients, limit),
  };
}

/** Taxa paga cobre a campanha enquanto os pendentes não passam do que foi cotado. */
export async function findPaidFee(broadcastId: string) {
  return prisma.broadcastFeePayment.findFirst({
    where: { broadcastId, status: "PAID" },
    orderBy: { paidAt: "desc" },
    select: { id: true, recipients: true },
  });
}

/** Barra `send`/`schedule` sem taxa paga, quando a cobrança está ligada (CA-4). */
export async function assertBroadcastFeePaid(broadcastId: string, pendingCount: number): Promise<void> {
  const settings = await loadBroadcastFeeSettings();
  if (!settings.enabled) return;
  const paid = await findPaidFee(broadcastId);
  if (!paid) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message: "Pague a taxa da campanha antes de disparar.",
      data: { reason: "FEE_REQUIRED" },
    });
  }
  if (pendingCount > paid.recipients) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message: `A taxa paga cobre ${paid.recipients} contatos e a campanha tem ${pendingCount}. Pague a diferença para disparar.`,
      data: { reason: "FEE_REQUIRED" },
    });
  }
}

export type FeePaymentMethod = "CARD" | "PIX";

export interface StartFeeCheckoutParams {
  broadcast: QuotableBroadcast & { name: string };
  organizationId: string;
  user: { id: string; name: string; email: string };
  paymentMethod: FeePaymentMethod;
  payerDocument?: string | null;
  dispatchMode: "NOW" | "SCHEDULE";
  scheduledAt?: Date | null;
  returnUrl: string;
}

export async function startFeeCheckout(params: StartFeeCheckoutParams): Promise<{ paymentId: string; checkoutUrl: string }> {
  const { broadcast, organizationId, user, paymentMethod } = params;
  const quote = await buildBroadcastQuote(broadcast, organizationId);
  if (quote.recipients === 0) {
    throw new ORPCError("BAD_REQUEST", { message: "Nenhum destinatário pendente para cobrar." });
  }
  const amountBrlCents = quote.fee.serviceFeeBrlCents;
  if (amountBrlCents < STRIPE_MIN_BRL_CENTS) {
    throw new ORPCError("BAD_REQUEST", { message: "Valor abaixo do mínimo do gateway." });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, cnpj: true },
  });
  const payerDocument = (params.payerDocument ?? organization?.cnpj ?? "").replace(/\D/g, "");
  const asaasGateway = paymentMethod === "PIX" ? loadTrafegoAsaasGateway() : null;
  if (paymentMethod === "PIX") {
    if (!asaasGateway) {
      throw new ORPCError("PRECONDITION_FAILED", { message: "PIX indisponível no momento. Use cartão." });
    }
    if (!isValidBrazilianDocument(payerDocument)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Informe um CPF ou CNPJ válido para pagar com PIX.",
        data: { field: "payerDocument" },
      });
    }
  }

  const payment = await prisma.broadcastFeePayment.create({
    data: {
      broadcastId: broadcast.id,
      organizationId,
      createdById: user.id,
      recipients: quote.recipients,
      templateCategory: quote.category,
      metaCostBrlCents: quote.metaCost.totalBrlCents,
      feePercent: quote.fee.feePercent,
      serviceFeeBrlCents: amountBrlCents,
      provider: paymentMethod === "PIX" ? "ASAAS" : "STRIPE",
      dispatchMode: params.dispatchMode,
      scheduledAt: params.scheduledAt ?? null,
    },
    select: { id: true },
  });

  const description = `Taxa ÓRBITA — campanha "${broadcast.name}" (${quote.recipients} contatos)`;
  try {
    if (asaasGateway) {
      const customer = await findOrCreateCustomer(asaasGateway.secretKey, asaasGateway.environment, {
        email: user.email,
        name: organization?.name ?? user.name,
        cpfCnpj: payerDocument,
        externalReference: organizationId,
      });
      const charge = await createCharge(asaasGateway.secretKey, asaasGateway.environment, {
        customerId: customer.id,
        billingType: "UNDEFINED",
        value: amountBrlCents / 100,
        dueDate: dueDatePlus(1),
        description,
        externalReference: `broadcast_fee:${payment.id}`,
        callbackSuccessUrl: params.returnUrl,
      });
      await prisma.broadcastFeePayment.update({
        where: { id: payment.id },
        data: { externalId: charge.id, checkoutUrl: charge.invoiceUrl },
      });
      return { paymentId: payment.id, checkoutUrl: charge.invoiceUrl };
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: amountBrlCents,
            product_data: { name: "Taxa de serviço — Disparo em Massa", description },
          },
        },
      ],
      metadata: { kind: "broadcast_fee", paymentId: payment.id, broadcastId: broadcast.id },
      success_url: `${params.returnUrl}${params.returnUrl.includes("?") ? "&" : "?"}fee=${payment.id}`,
      cancel_url: params.returnUrl,
    });
    await prisma.broadcastFeePayment.update({
      where: { id: payment.id },
      data: { externalId: session.id, checkoutUrl: session.url },
    });
    return { paymentId: payment.id, checkoutUrl: session.url ?? params.returnUrl };
  } catch (error) {
    await prisma.broadcastFeePayment.update({ where: { id: payment.id }, data: { status: "CANCELED" } });
    console.error("[campanhas/fee] checkout falhou:", error);
    throw new ORPCError("BAD_GATEWAY", { message: "Não foi possível abrir o pagamento agora. Tente de novo em instantes." });
  }
}

async function isPaidAtProvider(provider: string, externalId: string): Promise<boolean> {
  if (provider === "ASAAS") {
    const gateway = loadTrafegoAsaasGateway();
    if (!gateway) return false;
    const payment = await getPayment(gateway.secretKey, gateway.environment, externalId);
    return ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(payment.status);
  }
  const session = await getStripe().checkout.sessions.retrieve(externalId);
  return session.payment_status === "paid";
}

/**
 * Confere o pagamento na API do provedor (não no webhook) e, pago, libera a
 * campanha: dispara agora ou agenda, conforme escolhido no checkout.
 */
export async function confirmFeePayment(paymentId: string, organizationId: string) {
  const payment = await prisma.broadcastFeePayment.findFirst({ where: { id: paymentId, organizationId } });
  if (!payment) throw new ORPCError("NOT_FOUND", { message: "Pagamento não encontrado." });
  if (payment.status !== "PENDING" || !payment.externalId) {
    return { status: payment.status, isReleased: payment.status === "PAID" };
  }

  const isPaid = await isPaidAtProvider(payment.provider, payment.externalId).catch((error: unknown) => {
    console.error("[campanhas/fee] consulta ao provedor falhou:", error);
    return false;
  });
  if (!isPaid) return { status: "PENDING", isReleased: false };

  const claimed = await prisma.broadcastFeePayment.updateMany({
    where: { id: payment.id, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date() },
  });
  if (claimed.count === 0) return { status: "PAID", isReleased: true };

  if (payment.dispatchMode === "SCHEDULE" && payment.scheduledAt && payment.scheduledAt.getTime() > Date.now()) {
    const scheduled = await prisma.broadcast.updateMany({
      where: { id: payment.broadcastId, organizationId, status: { in: ["DRAFT", "SCHEDULED"] } },
      data: { status: "SCHEDULED", scheduledAt: payment.scheduledAt },
    });
    if (scheduled.count > 0) {
      await inngest
        .send({
          name: "campanhas/broadcast.scheduled",
          data: { broadcastId: payment.broadcastId, organizationId, scheduledAt: payment.scheduledAt.toISOString() },
        })
        .catch((error: unknown) => console.error("[campanhas/fee] agendamento falhou:", error));
    }
  } else {
    await beginBroadcastDispatch({
      broadcastId: payment.broadcastId,
      organizationId,
      fromStatuses: ["DRAFT", "SCHEDULED"],
    });
  }
  return { status: "PAID", isReleased: true };
}
