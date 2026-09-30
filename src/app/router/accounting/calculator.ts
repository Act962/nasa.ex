import { z } from "zod";
import prisma from "@/lib/prisma";
import { runCalculator } from "@/features/accounting/lib/calculator/calculator-registry";
import { loadTaxRates } from "@/features/accounting/server/tax-rates/load-tax-rates";
import { getOrCreateTaxProfile } from "@/features/accounting/server/profile/tax-profile";
import { loadRbt12 } from "@/features/accounting/server/revenue/load-revenue";
import { toMonthKey } from "@/features/accounting/lib/format";
import { TAX_RATE_SEED_KEYS_TO_VERIFY } from "@/features/accounting/lib/tax/seed/default-tax-rates";
import { accountingReadProcedure } from "./procedures";

export const taxKindSchema = z.enum([
  "DAS", "DAS_MEI", "IRPJ", "CSLL", "PIS", "COFINS", "ISS", "ICMS", "CBS", "IBS", "IS", "INSS", "FGTS", "IRRF",
]);

const calculationStepShape = z.object({
  label: z.string(),
  formula: z.string().optional(),
  value: z.string(),
  legalSource: z.string().optional(),
  termId: z.string().optional(),
});

export const calculationResultShape = z.object({
  output: z.unknown(),
  steps: z.array(calculationStepShape),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })),
  sources: z.array(z.string()),
});

/** Valores do perfil que pré-preenchem as calculadoras. */
export const getCalculatorContext = accountingReadProcedure
  .route({ method: "GET", summary: "Contexto das calculadoras (perfil + RBT12)", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .output(
    z.object({
      rbt12Cents: z.number(),
      payroll12mCents: z.number(),
      simplesAnnex: z.string(),
      isFatorRSubject: z.boolean(),
      issRateBps: z.number(),
      regime: z.enum(["MEI", "SIMPLES", "PRESUMIDO", "REAL"]),
      ibsCbsOutsideSimples: z.boolean(),
      commissionBps: z.number(),
      isRbt12Proportional: z.boolean(),
    }),
  )
  .handler(async ({ context }) => {
    const profile = await getOrCreateTaxProfile(context.org.id);
    const rbt12 = await loadRbt12({
      organizationId: context.org.id,
      periodMonth: toMonthKey(new Date()),
      openedAt: profile.openedAt,
    });
    const forgeSettings = await prisma.forgeSettings.findUnique({
      where: { organizationId: context.org.id },
      select: { commissionPercentage: true },
    });
    return {
      rbt12Cents: rbt12.rbt12Cents,
      payroll12mCents: profile.payroll12mCents,
      simplesAnnex: profile.simplesAnnex ?? "III",
      isFatorRSubject: profile.isFatorRSubject,
      issRateBps: profile.issRateBps ?? 500,
      regime: profile.regime,
      ibsCbsOutsideSimples: profile.ibsCbsOutsideSimples,
      commissionBps: Math.round(Number(forgeSettings?.commissionPercentage ?? 0) * 100),
      isRbt12Proportional: rbt12.isProportional,
    };
  });

export const runAccountingCalculator = accountingReadProcedure
  .route({ method: "POST", summary: "Executa uma calculadora contábil", tags: ["Accounting"] })
  .input(
    z.object({
      calculatorId: z.string().max(60),
      values: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()]).optional()),
      referenceDate: z.string().optional(),
    }),
  )
  .output(calculationResultShape)
  .handler(async ({ input, context, errors }) => {
    const rates = await loadTaxRates(context.org.id);
    const at = input.referenceDate ? new Date(`${input.referenceDate.slice(0, 10)}T12:00:00Z`) : new Date();
    const result = runCalculator(input.calculatorId, input.values, { rates, at });
    if (!result) throw errors.NOT_FOUND({ message: "Calculadora não encontrada" });
    return result;
  });

export const listAccountingTaxRates = accountingReadProcedure
  .route({ method: "GET", summary: "Tabelas de alíquotas vigentes", tags: ["Accounting"] })
  .input(z.object({ tax: taxKindSchema.optional() }).optional())
  .output(
    z.object({
      rates: z.array(
        z.object({
          id: z.string(),
          tax: z.string(),
          regime: z.string().nullable(),
          annex: z.string().nullable(),
          bracket: z.number().nullable(),
          revenueToCents: z.number().nullable(),
          rateBps: z.number(),
          deductionCents: z.number().nullable(),
          fixedAmountCents: z.number().nullable(),
          reductionBps: z.number().nullable(),
          validFrom: z.date(),
          validTo: z.date().nullable(),
          legalSource: z.string(),
          note: z.string().nullable(),
          needsVerification: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    await loadTaxRates(context.org.id);
    const rows = await prisma.taxRate.findMany({
      where: {
        OR: [{ organizationId: null }, { organizationId: context.org.id }],
        ...(input?.tax ? { tax: input.tax } : {}),
      },
      orderBy: [{ tax: "asc" }, { annex: "asc" }, { bracket: "asc" }, { validFrom: "asc" }],
    });
    return {
      rates: rows.map((row) => ({
        id: row.id,
        tax: row.tax,
        regime: row.regime,
        annex: row.annex,
        bracket: row.bracket,
        revenueToCents: row.revenueToCents,
        rateBps: row.rateBps,
        deductionCents: row.deductionCents,
        fixedAmountCents: row.fixedAmountCents,
        reductionBps: row.reductionBps,
        validFrom: row.validFrom,
        validTo: row.validTo,
        legalSource: row.legalSource,
        note: row.note,
        needsVerification: row.seedKey ? TAX_RATE_SEED_KEYS_TO_VERIFY.has(row.seedKey) : false,
      })),
    };
  });
