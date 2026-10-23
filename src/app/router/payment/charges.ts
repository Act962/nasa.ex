import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { buildChargeUrl } from "@/features/payment/lib/charge-link";
import { buildChargePixCode, getOpenAmountCents } from "@/features/payment/server/charges/charge-details";
import { PENDING_ENTRY_STATUSES } from "@/features/payment/server/entries/entry-include";
import { listCharges } from "@/features/payment/server/charges/list-charges";
import { scheduleDunningForEntry } from "@/features/payment/server/dunning/schedule";
import { formatCalendarDate, isValidDateValue, parseCalendarDate } from "@/features/payment/lib/dates";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { queueJournalSync } from "@/features/accounting/server/journal/queue-journal-sync";

// Spec 0115: link de pagamento de uma conta a receber (página pública com o PIX).

export const getPaymentChargeLink = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "POST", summary: "Get the public payment link of a receivable", tags: ["Payment"] })
  .input(z.object({ entryId: z.string() }))
  .output(z.object({ url: z.string(), hasPixKey: z.boolean(), openAmountCents: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const entry = await prisma.paymentEntry.findFirst({
      where: { id: input.entryId, organizationId: context.org.id },
      select: { id: true, type: true, status: true, amount: true, paidAmount: true },
    });
    if (!entry) throw errors.NOT_FOUND({ message: "Lançamento não encontrado." });
    if (entry.type !== "RECEIVABLE" || !(PENDING_ENTRY_STATUSES as readonly string[]).includes(entry.status)) {
      throw errors.BAD_REQUEST({ message: "Só conta a receber em aberto tem link de pagamento." });
    }

    const openAmountCents = getOpenAmountCents(entry);
    const pixCode = await buildChargePixCode({
      organizationId: context.org.id,
      entryId: entry.id,
      amountCents: openAmountCents,
    });
    return {
      url: buildChargeUrl(context.org.id, entry.id),
      hasPixKey: pixCode !== null,
      openAmountCents,
    };
  });

// Visão "Cobranças" (RF-16): contas a receber com cliente, com status do pagamento e do envio.
export const listPaymentCharges = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "GET", summary: "List receivables as charges", tags: ["Payment"] })
  .input(
    z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      categoryIds: z.array(z.string()).max(50).optional(),
      status: z.enum(["all", "open", "overdue", "paid", "cancelled"]).default("all"),
      channel: z.enum(["all", "WHATSAPP", "EMAIL", "none"]).default("all"),
      search: z.string().max(120).optional(),
      page: z.number().int().min(1).default(1),
      perPage: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ input, context }) => listCharges({ organizationId: context.org.id, ...input }));

const MAX_PAUSE_DAYS = 90;

// Cliente prometeu pagar: os avisos que caírem na pausa saem no fim dela (spec 0115).
export const setChargeDunningPause = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Pause or resume the dunning of a receivable", tags: ["Payment"] })
  .input(z.object({ entryId: z.string(), pausedUntil: z.string().refine(isValidDateValue).nullable() }))
  .output(z.object({ pausedUntil: z.date().nullable() }))
  .handler(async ({ input, context, errors }) => {
    const entry = await prisma.paymentEntry.findFirst({
      where: { id: input.entryId, organizationId: context.org.id, type: "RECEIVABLE" },
      select: { id: true, description: true },
    });
    if (!entry) throw errors.NOT_FOUND({ message: "Cobrança não encontrada." });

    const pausedUntil = input.pausedUntil ? parseCalendarDate(input.pausedUntil) : null;
    if (pausedUntil) {
      const days = (pausedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      if (days <= 0) throw errors.BAD_REQUEST({ message: "Escolha uma data futura." });
      if (days > MAX_PAUSE_DAYS) throw errors.BAD_REQUEST({ message: `A pausa vai até ${MAX_PAUSE_DAYS} dias.` });
    }

    await prisma.paymentEntry.update({ where: { id: entry.id }, data: { dunningPausedUntil: pausedUntil } });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name ?? "",
      userEmail: context.user.email ?? "",
      userImage: context.user.image,
      appSlug: "payment",
      subAppSlug: "payment-charges",
      featureKey: "payment.charge.dunning_paused",
      action: pausedUntil ? "payment.charge.dunning_paused" : "payment.charge.dunning_resumed",
      actionLabel: pausedUntil
        ? `Pausou os avisos de "${entry.description}" até ${formatCalendarDate(pausedUntil)}`
        : `Retomou os avisos de "${entry.description}"`,
      resource: entry.description,
      resourceId: entry.id,
    });
    return { pausedUntil };
  });

// Reabre uma cobrança cancelada e agenda de novo os avisos que ainda estão no futuro.
export const reopenCharge = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Reopen a cancelled receivable", tags: ["Payment"] })
  .input(z.object({ entryId: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const entry = await prisma.paymentEntry.findFirst({
      where: { id: input.entryId, organizationId: context.org.id, type: "RECEIVABLE" },
      select: { id: true, status: true, paidAmount: true, description: true },
    });
    if (!entry) throw errors.NOT_FOUND({ message: "Cobrança não encontrada." });
    if (entry.status !== "CANCELLED") throw errors.BAD_REQUEST({ message: "Só cobrança cancelada pode ser reaberta." });

    await prisma.paymentEntry.update({
      where: { id: entry.id },
      data: { status: entry.paidAmount > 0 ? "PARTIAL" : "PENDING" },
    });
    await queueJournalSync(context.org.id, [entry.id]);
    await scheduleDunningForEntry(entry.id).catch((error) => {
      console.error("[payment/charges reopen] dunning schedule failed:", error);
    });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name ?? "",
      userEmail: context.user.email ?? "",
      userImage: context.user.image,
      appSlug: "payment",
      subAppSlug: "payment-charges",
      featureKey: "payment.charge.reopened",
      action: "payment.charge.reopened",
      actionLabel: `Reabriu a cobrança "${entry.description}"`,
      resource: entry.description,
      resourceId: entry.id,
    });
    return { ok: true };
  });
