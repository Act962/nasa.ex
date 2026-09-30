import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  listCredits,
  loadCreditSummary,
  loadMissingInvoices,
  loadSupplierRanking,
} from "@/features/accounting/server/credits/load-credit-reports";
import { registerCreditsFromAttachment } from "@/features/accounting/server/credits/register-credit-from-attachment";
import { reprocessCredits } from "@/features/accounting/server/credits/reprocess-credits";
import { accountingReadProcedure, accountingWriteProcedure, monthKeySchemaPattern } from "./procedures";

// Créditos de IBS/CBS das notas de entrada (spec 0051, item 5).

const taxRegimeSchema = z.enum(["MEI", "SIMPLES", "PRESUMIDO", "REAL"]);
const creditStatusSchema = z.enum(["PENDING_PAYMENT", "AVAILABLE", "USED", "GLOSSED"]);
const creditTaxSchema = z.enum([
  "DAS", "DAS_MEI", "IRPJ", "CSLL", "PIS", "COFINS", "ISS", "ICMS", "CBS", "IBS", "IS", "INSS", "FGTS", "IRRF",
]);

const getCreditSummary = accountingReadProcedure
  .route({ method: "GET", summary: "Resumo mensal dos créditos de IBS/CBS", tags: ["Accounting"] })
  .input(z.object({ months: z.number().int().min(1).max(24).default(6) }).optional())
  .output(
    z.object({
      currentMonth: z.string(),
      isTestYear: z.boolean(),
      availableCbsCents: z.number(),
      availableIbsCents: z.number(),
      months: z.array(
        z.object({
          month: z.string(),
          cbsAvailableCents: z.number(),
          ibsAvailableCents: z.number(),
          pendingPaymentCents: z.number(),
          usedCents: z.number(),
          glossedCents: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => loadCreditSummary(context.org.id, input?.months ?? 6));

const listAccountingCredits = accountingReadProcedure
  .route({ method: "GET", summary: "Lista os créditos das notas de entrada", tags: ["Accounting"] })
  .input(
    z
      .object({
        status: creditStatusSchema.optional(),
        month: z.string().regex(monthKeySchemaPattern).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .optional(),
  )
  .output(
    z.object({
      credits: z.array(
        z.object({
          id: z.string(),
          tax: creditTaxSchema,
          amountCents: z.number(),
          status: creditStatusSchema,
          competence: z.string(),
          accessKey: z.string(),
          supplierName: z.string().nullable(),
          supplierDocument: z.string().nullable(),
          invoiceTotalCents: z.number().nullable(),
          attachmentId: z.string().nullable(),
          entryId: z.string().nullable(),
          entryDescription: z.string().nullable(),
          entryStatus: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => ({
    credits: await listCredits({
      organizationId: context.org.id,
      status: input?.status,
      month: input?.month,
      limit: input?.limit ?? 200,
    }),
  }));

const getSupplierRanking = accountingReadProcedure
  .route({ method: "GET", summary: "Fornecedores x crédito gerado (12 meses)", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .output(
    z.object({
      suppliers: z.array(
        z.object({
          contactId: z.string().nullable(),
          name: z.string(),
          document: z.string().nullable(),
          taxRegime: taxRegimeSchema.nullable(),
          purchasedCents: z.number(),
          creditCents: z.number(),
          creditRatioBps: z.number(),
          entryCount: z.number(),
          entriesWithoutInvoiceCount: z.number(),
          isSimplesLike: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => ({ suppliers: await loadSupplierRanking(context.org.id) }));

const getMissingInvoices = accountingReadProcedure
  .route({ method: "GET", summary: "Despesas pagas sem nota (crédito perdido)", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .output(
    z.object({
      referenceYear: z.number(),
      isFutureReference: z.boolean(),
      rateBps: z.number(),
      isEstimated: z.boolean(),
      totalAmountCents: z.number(),
      totalEstimatedCreditCents: z.number(),
      items: z.array(
        z.object({
          entryId: z.string(),
          description: z.string(),
          amountCents: z.number(),
          paidAt: z.date(),
          categoryName: z.string().nullable(),
          supplierName: z.string().nullable(),
          supplierTaxRegime: taxRegimeSchema.nullable(),
          estimatedCreditCents: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => loadMissingInvoices(context.org.id));

const registerCreditFromAttachment = accountingWriteProcedure
  .route({ method: "POST", summary: "Registra o crédito de uma nota anexada", tags: ["Accounting"] })
  .input(z.object({ attachmentId: z.string().min(1) }))
  .output(
    z.object({
      status: z.enum(["registered", "skipped"]),
      message: z.string(),
      createdCount: z.number(),
      updatedCount: z.number(),
      warnings: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context }) => {
    const result = await registerCreditsFromAttachment({
      organizationId: context.org.id,
      attachmentId: input.attachmentId,
    });
    if (result.status === "skipped") {
      return { status: "skipped" as const, message: result.message, createdCount: 0, updatedCount: 0, warnings: [] };
    }
    return {
      status: "registered" as const,
      message: `Crédito de ${result.taxes.join(" e ")} registrado.`,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      warnings: result.warnings,
    };
  });

const setSupplierRegime = accountingWriteProcedure
  .route({ method: "PUT", summary: "Define o regime tributário de um fornecedor", tags: ["Accounting"] })
  .input(z.object({ contactId: z.string().min(1), taxRegime: taxRegimeSchema.nullable() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const updated = await prisma.paymentContact.updateMany({
      where: { id: input.contactId, organizationId: context.org.id },
      data: { taxRegime: input.taxRegime },
    });
    if (updated.count === 0) throw errors.NOT_FOUND({ message: "Fornecedor não encontrado" });
    return { ok: true as const };
  });

const reprocessAccountingCredits = accountingWriteProcedure
  .route({ method: "POST", summary: "Relê as notas dos últimos 6 meses", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .output(
    z.object({
      scannedCount: z.number(),
      registeredCount: z.number(),
      skippedCount: z.number(),
      failedCount: z.number(),
    }),
  )
  .handler(async ({ context }) => reprocessCredits(context.org.id));

export const accountingCreditsRouter = {
  summary: getCreditSummary,
  list: listAccountingCredits,
  supplierRanking: getSupplierRanking,
  missingInvoices: getMissingInvoices,
  registerFromAttachment: registerCreditFromAttachment,
  setSupplierRegime,
  reprocess: reprocessAccountingCredits,
};
