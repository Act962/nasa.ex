import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { parseCalendarDate } from "@/features/payment/lib/dates";
import { scheduleDunningForEntry } from "@/features/payment/server/dunning/schedule";
import { queueJournalSync } from "@/features/accounting/server/journal/queue-journal-sync";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  complementDocumentPrefix,
  complementDueDateInput,
  isComplementOpen,
  isComplementSent,
} from "@/features/trafego/lib/complement";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";
import {
  loadOrderComplements,
  readServiceSpend,
  toComplementView,
} from "@/features/trafego/server/lib/service-fee-complement";

/** Cartão "Complementos" do admin do pedido (spec 0123, RF-13). Só admin do sistema. */

const ORDER_SELECT = {
  id: true,
  code: true,
  status: true,
  organizationId: true,
  adBudgetBrlCents: true,
  adBudgetPaidToMeta: true,
  serviceFeeBrlCents: true,
  startedAt: true,
  endsAt: true,
  metaCampaignIdsOutsideService: true,
} as const;

async function requireAgencyOrganizationId(): Promise<string> {
  const settings = await loadTrafegoSettings();
  if (!settings.agencyOrganizationId) {
    throw new ORPCError("BAD_REQUEST", { message: "Configure a org da agência nos ajustes do trafeGO." });
  }
  return settings.agencyOrganizationId;
}

async function requireOrder(orderId: string) {
  const order = await prisma.trafegoOrder.findUnique({ where: { id: orderId }, select: ORDER_SELECT });
  if (!order) throw new ORPCError("NOT_FOUND", { message: "Pedido não encontrado." });
  return order;
}

/** O lançamento tem de ser um complemento DESTE pedido, na org da agência. */
async function requireOrderComplement(params: { orderId: string; entryId: string }) {
  const [order, agencyOrganizationId] = await Promise.all([requireOrder(params.orderId), requireAgencyOrganizationId()]);
  const entry = await prisma.paymentEntry.findFirst({
    where: {
      id: params.entryId,
      organizationId: agencyOrganizationId,
      type: "RECEIVABLE",
      documentNumber: { startsWith: complementDocumentPrefix(order.code) },
    },
    select: { id: true, documentNumber: true, amount: true, paidAmount: true, status: true, dueDate: true, dunningRuleId: true },
  });
  if (!entry) throw new ORPCError("NOT_FOUND", { message: "Complemento não encontrado neste pedido." });
  return { order, agencyOrganizationId, entry };
}

export const listTrafegoComplements = base
  .use(requireAdminMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const [order, agencyOrganizationId] = await Promise.all([requireOrder(input.orderId), requireAgencyOrganizationId()]);
    const now = new Date();
    const complements = await loadOrderComplements(order.code, agencyOrganizationId);

    const isApplicable = order.adBudgetPaidToMeta && order.status !== "CANCELLED" && order.status !== "REFUNDED";
    const reading = isApplicable && order.startedAt ? await readServiceSpend(order, complements, now) : null;

    return {
      isApplicable,
      complements: complements.map((complement) => toComplementView(complement, agencyOrganizationId, now)),
      outsideCampaignIds: order.metaCampaignIdsOutsideService,
      reading:
        reading?.status === "ok"
          ? {
              status: "ok" as const,
              since: reading.window.since,
              until: reading.window.until,
              spentBrlCents: reading.due.spentBrlCents,
              dueFeeBrlCents: reading.due.dueFeeBrlCents,
              chargedBrlCents: reading.due.chargedBrlCents,
              pendingComplementBrlCents: reading.due.shouldCreate ? reading.due.complementBrlCents : 0,
              isTruncated: reading.isTruncated,
              campaigns: reading.campaigns
                .filter((campaign): campaign is typeof campaign & { campaignId: string } => Boolean(campaign.campaignId))
                .map((campaign) => ({
                  id: campaign.campaignId,
                  name: campaign.campaignName ?? campaign.campaignId,
                  spendBrlCents: campaign.spendBrlCents,
                }))
                .sort((first, second) => second.spendBrlCents - first.spendBrlCents),
            }
          : reading?.status === "unavailable"
            ? { status: "unavailable" as const, message: reading.message }
            : reading?.status === "non_brl"
              ? { status: "unavailable" as const, message: `A conta é em ${reading.currency}: sem complemento.` }
              : { status: "not_applicable" as const },
    };
  });

/** "Enviar cobrança": atribui a régua padrão das Cobranças, que manda o link e o PIX (CA-11). */
export const sendTrafegoComplement = base
  .use(requireAdminMiddleware)
  .input(z.object({ orderId: z.string().min(1), entryId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const { order, agencyOrganizationId, entry } = await requireOrderComplement(input);
    if (!isComplementOpen(entry)) throw new ORPCError("BAD_REQUEST", { message: "Este complemento não está em aberto." });
    if (isComplementSent(entry)) throw new ORPCError("BAD_REQUEST", { message: "A cobrança deste complemento já foi enviada." });

    const rule = await prisma.paymentDunningRule.findFirst({
      where: { organizationId: agencyOrganizationId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    });
    if (!rule) {
      throw new ORPCError("BAD_REQUEST", { message: "Crie uma régua ativa nas Cobranças da org da agência antes de enviar." });
    }

    // Rascunho que esperou dias não pode chegar ao cliente já vencido: o prazo conta do envio.
    const now = new Date();
    const freshDueDate = parseCalendarDate(complementDueDateInput(now));
    const dueDate = entry.dueDate.getTime() < freshDueDate.getTime() ? freshDueDate : entry.dueDate;

    await prisma.paymentEntry.update({
      where: { id: entry.id },
      data: { dunningRuleId: rule.id, dueDate, ...(entry.status === "OVERDUE" ? { status: "PENDING" as const } : {}) },
    });
    await prisma.trafegoOrderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        title: `Cobrança do complemento ${entry.documentNumber} enviada`,
        detail: `${formatBrlFromCents(entry.amount)} pelo gasto acima da verba declarada. Vence em ${dueDate.toISOString().slice(0, 10).split("-").reverse().join("/")}.`,
        isClientVisible: true,
        actorUserId: context.adminUser.id,
        source: "ADMIN",
      },
    });

    const schedule = await scheduleDunningForEntry(entry.id).catch((error: unknown) => {
      console.error("[trafego/complements send] régua não agendada:", error);
      return { scheduled: 0, reason: "error" };
    });
    await queueJournalSync(agencyOrganizationId, [entry.id]);
    return { ruleName: rule.name, scheduled: schedule.scheduled };
  });

export const cancelTrafegoComplement = base
  .use(requireAdminMiddleware)
  .input(z.object({ orderId: z.string().min(1), entryId: z.string().min(1), reason: z.string().trim().min(3).max(300) }))
  .handler(async ({ input, context }) => {
    const { order, agencyOrganizationId, entry } = await requireOrderComplement(input);
    if (entry.status === "CANCELLED") throw new ORPCError("BAD_REQUEST", { message: "Complemento já cancelado." });
    if (entry.paidAmount > 0 || entry.status === "PAID") {
      throw new ORPCError("BAD_REQUEST", { message: "Este complemento já recebeu pagamento: ajuste no Payment." });
    }

    await prisma.paymentEntry.update({ where: { id: entry.id }, data: { status: "CANCELLED" } });
    await prisma.trafegoOrderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        title: `Complemento ${entry.documentNumber} cancelado`,
        detail: input.reason,
        isClientVisible: isComplementSent(entry),
        actorUserId: context.adminUser.id,
        source: "ADMIN",
      },
    });
    await queueJournalSync(agencyOrganizationId, [entry.id]);
    return { ok: true };
  });

/** Campanhas da conta que não são do trafeGO (outra agência, ação própria do cliente): saem da base (CA-9). */
export const setTrafegoOutsideCampaigns = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      campaignIds: z.array(z.string().regex(/^\d{1,30}$/, "Id de campanha inválido.")).max(200),
    }),
  )
  .handler(async ({ input, context }) => {
    const order = await requireOrder(input.orderId);
    const campaignIds = [...new Set(input.campaignIds)];
    await prisma.trafegoOrder.update({
      where: { id: order.id },
      data: { metaCampaignIdsOutsideService: campaignIds },
    });
    await prisma.trafegoOrderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        title: "Campanhas fora do trafeGO atualizadas",
        detail: campaignIds.length > 0 ? `${campaignIds.length} campanha(s) fora da base do complemento.` : "Nenhuma campanha fora da base.",
        isClientVisible: false,
        actorUserId: context.adminUser.id,
        source: "ADMIN",
      },
    });
    return { campaignIds };
  });
