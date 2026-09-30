import "server-only";

import prisma from "@/lib/prisma";
import type { TaxCreditStatus, TaxRegime } from "@/generated/prisma/client";
import { applyBps, ratioToBps, shiftMonthKey, toMonthKey } from "@/features/accounting/lib/format";
import { selectSingleRate } from "@/features/accounting/lib/tax/rate-lookup";
import { loadTaxRates } from "@/features/accounting/server/tax-rates/load-tax-rates";
import { documentDigits } from "@/features/payment/lib/documents/normalize-document";

// Leituras da subaba Créditos (spec 0051, item 5): resumo por mês, ranking de
// fornecedores e despesas pagas sem nota (crédito perdido).

const TEST_YEAR = 2026;
const INVOICE_MIME_TYPES = ["application/xml", "text/xml"];
const TAX_CATEGORY_NAME = "impostos e taxas";

function normalizeCategoryName(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export async function loadCreditSummary(organizationId: string, monthsBack: number) {
  const currentMonth = toMonthKey(new Date());
  const fromMonth = shiftMonthKey(currentMonth, -(monthsBack - 1));
  const grouped = await prisma.taxCredit.groupBy({
    by: ["competence", "tax", "status"],
    where: { organizationId, competence: { gte: fromMonth }, tax: { in: ["CBS", "IBS"] } },
    _sum: { amountCents: true },
  });

  const months = Array.from({ length: monthsBack }, (_, index) => shiftMonthKey(fromMonth, index)).map((month) => {
    const rowsOfMonth = grouped.filter((row) => row.competence === month);
    const sumWhere = (predicate: (row: (typeof grouped)[number]) => boolean) =>
      rowsOfMonth.filter(predicate).reduce((total, row) => total + (row._sum.amountCents ?? 0), 0);
    return {
      month,
      cbsAvailableCents: sumWhere((row) => row.tax === "CBS" && row.status === "AVAILABLE"),
      ibsAvailableCents: sumWhere((row) => row.tax === "IBS" && row.status === "AVAILABLE"),
      pendingPaymentCents: sumWhere((row) => row.status === "PENDING_PAYMENT"),
      usedCents: sumWhere((row) => row.status === "USED"),
      glossedCents: sumWhere((row) => row.status === "GLOSSED"),
    };
  });

  const allAvailable = await prisma.taxCredit.groupBy({
    by: ["tax"],
    where: { organizationId, status: "AVAILABLE", tax: { in: ["CBS", "IBS"] } },
    _sum: { amountCents: true },
  });

  return {
    currentMonth,
    isTestYear: new Date().getUTCFullYear() <= TEST_YEAR,
    months,
    availableCbsCents: allAvailable.find((row) => row.tax === "CBS")?._sum.amountCents ?? 0,
    availableIbsCents: allAvailable.find((row) => row.tax === "IBS")?._sum.amountCents ?? 0,
  };
}

export async function listCredits(params: {
  organizationId: string;
  status?: TaxCreditStatus;
  month?: string;
  limit: number;
}) {
  const credits = await prisma.taxCredit.findMany({
    where: {
      organizationId: params.organizationId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.month ? { competence: params.month } : {}),
    },
    orderBy: [{ competence: "desc" }, { createdAt: "desc" }],
    take: params.limit,
  });
  const entryIds = [...new Set(credits.map((credit) => credit.entryId).filter((entryId): entryId is string => Boolean(entryId)))];
  const entries = entryIds.length
    ? await prisma.paymentEntry.findMany({
        where: { organizationId: params.organizationId, id: { in: entryIds } },
        select: { id: true, description: true, status: true },
      })
    : [];
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));

  return credits.map((credit) => {
    const entry = credit.entryId ? entryById.get(credit.entryId) : undefined;
    return {
      id: credit.id,
      tax: credit.tax,
      amountCents: credit.amountCents,
      status: credit.status,
      competence: credit.competence,
      accessKey: credit.accessKey,
      supplierName: credit.supplierName,
      supplierDocument: credit.supplierDocument,
      invoiceTotalCents: credit.invoiceTotalCents,
      attachmentId: credit.attachmentId,
      entryId: credit.entryId,
      entryDescription: entry?.description ?? null,
      entryStatus: entry?.status ?? null,
    };
  });
}

export async function loadSupplierRanking(organizationId: string) {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 12);
  const fromMonth = toMonthKey(since);

  const [entries, credits] = await Promise.all([
    prisma.paymentEntry.findMany({
      where: {
        organizationId,
        type: "PAYABLE",
        status: { notIn: ["CANCELLED", "PENDING_APPROVAL"] },
        contactId: { not: null },
        OR: [{ competenceDate: { gte: since } }, { competenceDate: null, dueDate: { gte: since } }],
      },
      select: {
        id: true,
        amount: true,
        contactId: true,
        attachments: {
          where: { OR: [{ kind: "NOTA_FISCAL" }, { mimeType: { in: INVOICE_MIME_TYPES } }] },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.taxCredit.findMany({
      where: { organizationId, tax: { in: ["CBS", "IBS"] }, status: { not: "GLOSSED" }, competence: { gte: fromMonth } },
      select: { supplierContactId: true, supplierDocument: true, supplierName: true, amountCents: true, invoiceTotalCents: true, accessKey: true },
    }),
  ]);

  const contactIds = [...new Set(entries.map((entry) => entry.contactId).filter((contactId): contactId is string => Boolean(contactId)))];
  const contacts = contactIds.length
    ? await prisma.paymentContact.findMany({
        where: { organizationId, id: { in: contactIds } },
        select: { id: true, name: true, document: true, taxRegime: true },
      })
    : [];

  interface RankingRow {
    key: string;
    contactId: string | null;
    name: string;
    document: string | null;
    taxRegime: TaxRegime | null;
    purchasedCents: number;
    creditCents: number;
    entryCount: number;
    entriesWithoutInvoiceCount: number;
  }
  const rowsByKey = new Map<string, RankingRow>();
  const contactKeyByDocument = new Map<string, string>();

  for (const contact of contacts) {
    const key = `contact:${contact.id}`;
    rowsByKey.set(key, {
      key,
      contactId: contact.id,
      name: contact.name,
      document: documentDigits(contact.document),
      taxRegime: contact.taxRegime,
      purchasedCents: 0,
      creditCents: 0,
      entryCount: 0,
      entriesWithoutInvoiceCount: 0,
    });
    const digits = documentDigits(contact.document);
    if (digits) contactKeyByDocument.set(digits, key);
  }

  for (const entry of entries) {
    const row = entry.contactId ? rowsByKey.get(`contact:${entry.contactId}`) : undefined;
    if (!row) continue;
    row.purchasedCents += entry.amount;
    row.entryCount += 1;
    if (entry.attachments.length === 0) row.entriesWithoutInvoiceCount += 1;
  }

  const countedInvoiceKeys = new Set<string>();
  for (const credit of credits) {
    const key =
      (credit.supplierContactId && rowsByKey.has(`contact:${credit.supplierContactId}`)
        ? `contact:${credit.supplierContactId}`
        : null) ??
      (credit.supplierDocument ? contactKeyByDocument.get(credit.supplierDocument) : undefined) ??
      `document:${credit.supplierDocument ?? credit.supplierName ?? "desconhecido"}`;
    let row = rowsByKey.get(key);
    if (!row) {
      row = {
        key,
        contactId: null,
        name: credit.supplierName ?? "Fornecedor sem cadastro",
        document: credit.supplierDocument,
        taxRegime: null,
        purchasedCents: 0,
        creditCents: 0,
        entryCount: 0,
        entriesWithoutInvoiceCount: 0,
      };
      rowsByKey.set(key, row);
    }
    row.creditCents += credit.amountCents;
    // Fornecedor fora do financeiro: o "comprado" vem do total das notas (uma vez por nota).
    if (!row.contactId && credit.invoiceTotalCents && !countedInvoiceKeys.has(credit.accessKey)) {
      countedInvoiceKeys.add(credit.accessKey);
      row.purchasedCents += credit.invoiceTotalCents;
      row.entryCount += 1;
    }
  }

  return [...rowsByKey.values()]
    .filter((row) => row.purchasedCents > 0 || row.creditCents > 0)
    .sort((left, right) => right.purchasedCents - left.purchasedCents)
    .slice(0, 50)
    .map((row) => ({
      contactId: row.contactId,
      name: row.name,
      document: row.document,
      taxRegime: row.taxRegime,
      purchasedCents: row.purchasedCents,
      creditCents: row.creditCents,
      creditRatioBps: ratioToBps(row.creditCents, row.purchasedCents),
      entryCount: row.entryCount,
      entriesWithoutInvoiceCount: row.entriesWithoutInvoiceCount,
      isSimplesLike: row.taxRegime === "SIMPLES" || row.taxRegime === "MEI",
    }));
}

/** Alíquota CBS+IBS de referência para estimar crédito; em 2026 (ano-teste) usa a de 2027. */
async function resolveReferenceCreditRate(organizationId: string) {
  const currentYear = new Date().getUTCFullYear();
  const referenceYear = currentYear <= TEST_YEAR ? TEST_YEAR + 1 : currentYear;
  const referenceDate = referenceYear === currentYear ? new Date() : new Date(Date.UTC(referenceYear, 0, 15));
  const rates = await loadTaxRates(organizationId);
  const cbsRow = selectSingleRate(rates, { tax: "CBS", at: referenceDate });
  const ibsRow = selectSingleRate(rates, { tax: "IBS", at: referenceDate });
  const isEstimated = Boolean(cbsRow?.note?.includes("estimada") || ibsRow?.note?.includes("estimada"));
  return {
    referenceYear,
    isFutureReference: referenceYear > currentYear,
    rateBps: (cbsRow?.rateBps ?? 0) + (ibsRow?.rateBps ?? 0),
    isEstimated,
  };
}

export async function loadMissingInvoices(organizationId: string) {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 3);

  const [entries, reference] = await Promise.all([
    prisma.paymentEntry.findMany({
      where: {
        organizationId,
        type: "PAYABLE",
        status: "PAID",
        OR: [{ paidAt: { gte: since } }, { paidAt: null, dueDate: { gte: since } }],
        attachments: {
          none: { OR: [{ kind: { in: ["NOTA_FISCAL", "RECIBO"] } }, { mimeType: { in: INVOICE_MIME_TYPES } }] },
        },
      },
      orderBy: { amount: "desc" },
      take: 300,
      select: {
        id: true,
        description: true,
        amount: true,
        paidAmount: true,
        paidAt: true,
        dueDate: true,
        category: { select: { name: true } },
        contact: { select: { name: true, taxRegime: true } },
      },
    }),
    resolveReferenceCreditRate(organizationId),
  ]);

  const items = entries
    .filter((entry) => normalizeCategoryName(entry.category?.name) !== TAX_CATEGORY_NAME)
    .slice(0, 100)
    .map((entry) => {
      const paidCents = entry.paidAmount > 0 ? entry.paidAmount : entry.amount;
      return {
        entryId: entry.id,
        description: entry.description,
        amountCents: paidCents,
        paidAt: entry.paidAt ?? entry.dueDate,
        categoryName: entry.category?.name ?? null,
        supplierName: entry.contact?.name ?? null,
        supplierTaxRegime: entry.contact?.taxRegime ?? null,
        estimatedCreditCents: applyBps(paidCents, reference.rateBps),
      };
    });

  return {
    ...reference,
    items,
    totalAmountCents: items.reduce((total, item) => total + item.amountCents, 0),
    totalEstimatedCreditCents: items.reduce((total, item) => total + item.estimatedCreditCents, 0),
  };
}
