import "server-only";

import prisma from "@/lib/prisma";
import { createPaymentEntryRecord } from "@/features/payment/server/entries/create-entry";
import { buildChargeUrl } from "@/features/payment/lib/charge-link";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  COMPLEMENT_ORDER_STATUSES,
  complementDocumentPrefix,
  complementDueDateInput,
  computeComplementDue,
  hasOverdueComplement,
  isComplementOpen,
  isComplementOverdue,
  isComplementEligibleOrder,
  isComplementSent,
  nextComplementDocumentNumber,
  resolveComplementWindow,
  sumServiceSpendBrlCents,
  type ComplementDue,
  type ComplementEntrySnapshot,
} from "@/features/trafego/lib/complement";
import { getAccountSpendByCampaign, type AccountCampaignSpend } from "./meta/order-meta-performance";
import { resolveOrderMetaAccess } from "./meta/order-meta-access";
import { loadTrafegoSettings } from "./trafego-settings";
import { notifyTrafegoAdmins, recordTrafegoInternalEvent } from "./trafego-alerts";

/**
 * Complemento da taxa pelo gasto real (spec 0123, RF-11..RF-15). Os complementos são
 * lançamentos a receber na org da agência, achados pelo número `TG-NNNN-Cn`: sem tabela nova.
 */

const COMPLEMENT_SELECT = {
  id: true,
  documentNumber: true,
  amount: true,
  paidAmount: true,
  status: true,
  dueDate: true,
  dunningRuleId: true,
  createdAt: true,
} as const;

export async function loadOrderComplements(
  orderCode: string,
  agencyOrganizationId: string,
): Promise<ComplementEntrySnapshot[]> {
  return prisma.paymentEntry.findMany({
    where: {
      organizationId: agencyOrganizationId,
      type: "RECEIVABLE",
      documentNumber: { startsWith: complementDocumentPrefix(orderCode) },
    },
    orderBy: { createdAt: "asc" },
    select: COMPLEMENT_SELECT,
  });
}

type ComplementOrder = {
  id: string;
  code: string;
  organizationId: string;
  adBudgetBrlCents: number;
  serviceFeeBrlCents: number;
  startedAt: Date | null;
  endsAt: Date | null;
  metaCampaignIdsOutsideService: string[];
};

export type ServiceSpendReading =
  | {
      status: "ok";
      window: { since: string; until: string };
      due: ComplementDue;
      campaigns: AccountCampaignSpend[];
      isTruncated: boolean;
    }
  | { status: "not_applicable" }
  | { status: "unavailable"; message: string }
  | { status: "non_brl"; currency: string };

/** Gasto considerado e taxa devida de um pedido, lidos da conta Meta da org do pedido. */
export async function readServiceSpend(
  order: ComplementOrder,
  complements: ComplementEntrySnapshot[],
  now: Date,
): Promise<ServiceSpendReading> {
  const access = await resolveOrderMetaAccess(order);
  if (access.mode === "legacy") return { status: "not_applicable" };
  if (access.mode === "unavailable") return { status: "unavailable", message: access.message };
  if (access.account.currency.toUpperCase() !== "BRL") return { status: "non_brl", currency: access.account.currency };

  const window = resolveComplementWindow({
    startedAt: order.startedAt,
    endsAt: order.endsAt,
    timeZone: access.account.timezoneName,
    now,
  });
  if (!window) return { status: "not_applicable" };

  const spend = await getAccountSpendByCampaign(access, window);
  const due = computeComplementDue({
    adBudgetBrlCents: order.adBudgetBrlCents,
    serviceFeeBrlCents: order.serviceFeeBrlCents,
    spentBrlCents: sumServiceSpendBrlCents(spend.campaigns, order.metaCampaignIdsOutsideService),
    complements,
  });
  return { status: "ok", window, due, campaigns: spend.campaigns, isTruncated: spend.isTruncated };
}

async function resolveComplementActor() {
  return prisma.user.findFirst({
    where: { isSystemAdmin: true, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, image: true },
  });
}

/** Avisa a equipe uma vez por complemento enviado que venceu (RF-15). O evento interno é o registro do aviso. */
async function notifyOverdueComplements(
  order: Pick<ComplementOrder, "id" | "code">,
  complements: ComplementEntrySnapshot[],
  now: Date,
): Promise<number> {
  let notified = 0;
  for (const complement of complements) {
    if (!isComplementOverdue(complement, now) || !complement.documentNumber) continue;
    const title = `Complemento ${complement.documentNumber} vencido`;
    const alreadyNotified = await prisma.trafegoOrderEvent.count({ where: { orderId: order.id, title } });
    if (alreadyNotified > 0) continue;
    await recordTrafegoInternalEvent({
      orderId: order.id,
      title,
      detail: `${formatBrlFromCents(complement.amount - complement.paidAmount)} em aberto. O painel do cliente ficou travado para criar e publicar campanhas.`,
    });
    await notifyTrafegoAdmins({
      title: `trafeGO ${order.code}: complemento vencido`,
      body: `${complement.documentNumber} venceu sem pagamento. O painel do cliente está travado.`,
      actionUrl: `/admin/trafego/${order.id}`,
    });
    notified++;
  }
  return notified;
}

/**
 * Um passo no fim do cron diário `sync-meta-ads-kpis` (RNF-1): uma leitura da Meta por
 * pedido ativo. Idempotente: o "já cobrado" inclui os complementos criados, então rodar
 * de novo no mesmo dia não cria outro (CA-8).
 */
export async function reconcileTrafegoComplements(now = new Date()) {
  const settings = await loadTrafegoSettings({ fresh: true });
  const agencyOrganizationId = settings.agencyOrganizationId;
  if (!agencyOrganizationId) return { checked: 0, created: 0, overdueNotified: 0, errors: ["sem org da agência"] };

  const orders = await prisma.trafegoOrder.findMany({
    where: {
      platform: "META_ADS",
      adBudgetPaidToMeta: true,
      startedAt: { not: null },
      status: { in: [...COMPLEMENT_ORDER_STATUSES] },
    },
    select: {
      id: true,
      code: true,
      organizationId: true,
      adBudgetBrlCents: true,
      serviceFeeBrlCents: true,
      startedAt: true,
      endsAt: true,
      metaCampaignIdsOutsideService: true,
      leadId: true,
      businessName: true,
      platform: true,
      adBudgetPaidToMeta: true,
      status: true,
    },
  });

  let created = 0;
  let overdueNotified = 0;
  const errors: string[] = [];
  const actor = orders.length > 0 ? await resolveComplementActor() : null;

  for (const order of orders.filter(isComplementEligibleOrder)) {
    try {
      const complements = await loadOrderComplements(order.code, agencyOrganizationId);
      overdueNotified += await notifyOverdueComplements(order, complements, now);

      const reading = await readServiceSpend(order, complements, now);
      if (reading.status === "unavailable") {
        await recordTrafegoInternalEvent({
          orderId: order.id,
          title: "Complemento não calculado",
          detail: `A conexão com a Meta da empresa falhou: ${reading.message}`,
        });
        continue;
      }
      if (reading.status === "non_brl") {
        await recordTrafegoInternalEvent({
          orderId: order.id,
          title: "Complemento não calculado",
          detail: `A conta de anúncios é em ${reading.currency}: o complemento só é calculado em reais.`,
        });
        continue;
      }
      if (reading.status !== "ok" || !reading.due.shouldCreate) continue;
      if (!actor) {
        errors.push(`${order.code}: nenhum admin do sistema para registrar o complemento`);
        continue;
      }

      const documentNumber = nextComplementDocumentNumber(
        order.code,
        complements.map((complement) => complement.documentNumber),
      );
      const { due } = reading;
      await createPaymentEntryRecord({
        organizationId: agencyOrganizationId,
        actor,
        input: {
          type: "RECEIVABLE",
          description: `trafeGO ${order.code} — complemento da taxa pelo gasto real`,
          amount: due.complementBrlCents,
          dueDate: complementDueDateInput(now),
          categoryId: settings.financeRevenueCategoryId ?? undefined,
          accountId: settings.financeAccountId ?? undefined,
          trackingId: settings.operationsTrackingId ?? settings.salesTrackingId ?? undefined,
          leadId: order.leadId ?? undefined,
          documentNumber,
          notes: `Gasto na conta de ${reading.window.since} a ${reading.window.until}: ${formatBrlFromCents(due.spentBrlCents)}. Taxa devida ${formatBrlFromCents(due.dueFeeBrlCents)}, já cobrado ${formatBrlFromCents(due.chargedBrlCents)}.${reading.isTruncated ? " Leitura parcial da Meta: confira no Gerenciador." : ""}`,
        },
      });
      created++;

      await recordTrafegoInternalEvent({
        orderId: order.id,
        title: `Complemento ${documentNumber} criado`,
        detail: `${formatBrlFromCents(due.complementBrlCents)} sobre ${formatBrlFromCents(due.spentBrlCents)} de gasto real (verba declarada ${formatBrlFromCents(order.adBudgetBrlCents)}). Rascunho: confira e envie a cobrança.`,
      });
      await notifyTrafegoAdmins({
        title: `trafeGO ${order.code}: complemento para enviar`,
        body: `${documentNumber} de ${formatBrlFromCents(due.complementBrlCents)}${order.businessName ? ` · ${order.businessName}` : ""}. Confira e envie a cobrança.`,
        actionUrl: `/admin/trafego/${order.id}`,
      });
    } catch (error) {
      errors.push(`${order.code}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { checked: orders.length, created, overdueNotified, errors };
}

export interface ComplementView {
  id: string;
  documentNumber: string;
  amountBrlCents: number;
  paidBrlCents: number;
  status: ComplementEntrySnapshot["status"];
  dueDate: string;
  isSent: boolean;
  isOverdue: boolean;
  chargeUrl: string | null;
}

export function toComplementView(
  complement: ComplementEntrySnapshot,
  agencyOrganizationId: string,
  now: Date,
): ComplementView {
  const isSent = isComplementSent(complement);
  return {
    id: complement.id,
    documentNumber: complement.documentNumber ?? "",
    amountBrlCents: complement.amount,
    paidBrlCents: complement.paidAmount,
    status: complement.status,
    dueDate: complement.dueDate.toISOString().slice(0, 10),
    isSent,
    isOverdue: isComplementOverdue(complement, now),
    chargeUrl: isSent && isComplementOpen(complement) ? buildChargeUrl(agencyOrganizationId, complement.id) : null,
  };
}

/** Trava da org (RF-15): algum pedido dela com complemento enviado e vencido. Só banco, sem Meta. */
export async function getTrafegoBillingLock(organizationId: string, now = new Date()) {
  const settings = await loadTrafegoSettings();
  if (!settings.agencyOrganizationId) return { isLocked: false as const };

  const orders = await prisma.trafegoOrder.findMany({
    where: { organizationId, adBudgetPaidToMeta: true, startedAt: { not: null } },
    select: { id: true, code: true },
  });
  if (orders.length === 0) return { isLocked: false as const };

  const complements = await prisma.paymentEntry.findMany({
    where: {
      organizationId: settings.agencyOrganizationId,
      type: "RECEIVABLE",
      dunningRuleId: { not: null },
      OR: orders.map((order) => ({ documentNumber: { startsWith: complementDocumentPrefix(order.code) } })),
    },
    select: COMPLEMENT_SELECT,
  });
  const overdue = complements.find((complement) => isComplementOverdue(complement, now));
  const lockedOrder = overdue
    ? orders.find((order) => overdue.documentNumber?.startsWith(complementDocumentPrefix(order.code)))
    : undefined;
  if (!overdue || !lockedOrder) return { isLocked: false as const };

  return {
    isLocked: true as const,
    orderId: lockedOrder.id,
    orderCode: lockedOrder.code,
    complement: toComplementView(overdue, settings.agencyOrganizationId, now),
  };
}

/** Usado pela guarda de criação e publicação (spec 0124). */
export async function hasOverdueTrafegoComplement(order: { code: string }, now = new Date()): Promise<boolean> {
  const settings = await loadTrafegoSettings();
  if (!settings.agencyOrganizationId) return false;
  return hasOverdueComplement(await loadOrderComplements(order.code, settings.agencyOrganizationId), now);
}
