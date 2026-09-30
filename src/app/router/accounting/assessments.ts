import { z } from "zod";
import prisma from "@/lib/prisma";
import { assessPeriod } from "@/features/accounting/server/assessments/assess-period";
import { confirmAssessment } from "@/features/accounting/server/assessments/confirm-assessment";
import { syncFiscalObligations } from "@/features/accounting/server/obligations/sync-fiscal-obligations";
import { accountingReadProcedure, accountingWriteProcedure, monthKeySchemaPattern } from "./procedures";
import { taxKindSchema } from "./calculator";

const assessmentShape = z.object({
  id: z.string(),
  period: z.string(),
  tax: taxKindSchema,
  baseCents: z.number(),
  effectiveRateBps: z.number(),
  amountCents: z.number(),
  creditsCents: z.number(),
  calculationMemo: z.unknown(),
  status: z.enum(["DRAFT", "CONFIRMED", "PAID", "CANCELLED"]),
  dueDate: z.date().nullable(),
  paymentEntryId: z.string().nullable(),
  confirmedAt: z.date().nullable(),
  updatedAt: z.date(),
});

export const listAccountingAssessments = accountingReadProcedure
  .route({ method: "GET", summary: "Apurações de tributos", tags: ["Accounting"] })
  .input(z.object({ year: z.number().int().min(2000).max(2100).optional() }).optional())
  .output(z.object({ assessments: z.array(assessmentShape) }))
  .handler(async ({ input, context }) => {
    const year = input?.year ?? new Date().getUTCFullYear();
    const assessments = await prisma.taxAssessment.findMany({
      where: { organizationId: context.org.id, period: { startsWith: String(year) } },
      orderBy: [{ period: "desc" }, { tax: "asc" }],
    });
    return { assessments };
  });

export const runAccountingAssessment = accountingWriteProcedure
  .route({ method: "POST", summary: "Apura os tributos de um mês", tags: ["Accounting"] })
  .input(z.object({ periodMonth: z.string().regex(monthKeySchemaPattern) }))
  .output(z.object({ assessments: z.array(assessmentShape) }))
  .handler(async ({ input, context }) => {
    const assessments = await assessPeriod({ organizationId: context.org.id, periodMonth: input.periodMonth });
    return { assessments };
  });

export const confirmAccountingAssessment = accountingWriteProcedure
  .route({ method: "POST", summary: "Confirma a apuração e gera a guia", tags: ["Accounting"] })
  .input(z.object({ assessmentId: z.string() }))
  .output(z.object({ paymentEntryId: z.string().nullable() }))
  .handler(async ({ input, context, errors }) => {
    const result = await confirmAssessment({
      organizationId: context.org.id,
      assessmentId: input.assessmentId,
      actor: context.user,
    });
    if (!result.ok) {
      if (result.reason === "not_found") throw errors.NOT_FOUND({ message: result.message });
      throw errors.BAD_REQUEST({ message: result.message });
    }
    await syncFiscalObligations(context.org.id);
    return { paymentEntryId: result.paymentEntryId };
  });

/** Volta uma apuração confirmada (sem guia paga) para rascunho. */
export const reopenAccountingAssessment = accountingWriteProcedure
  .route({ method: "POST", summary: "Reabre uma apuração", tags: ["Accounting"] })
  .input(z.object({ assessmentId: z.string() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const assessment = await prisma.taxAssessment.findFirst({
      where: { id: input.assessmentId, organizationId: context.org.id },
    });
    if (!assessment) throw errors.NOT_FOUND({ message: "Apuração não encontrada" });
    if (assessment.status === "PAID") {
      throw errors.BAD_REQUEST({ message: "Guia já paga: estorne o pagamento no financeiro antes de reabrir." });
    }
    if (assessment.paymentEntryId) {
      await prisma.paymentEntry.updateMany({
        where: { id: assessment.paymentEntryId, organizationId: context.org.id, status: { not: "PAID" } },
        data: { status: "CANCELLED" },
      });
    }
    await prisma.taxAssessment.update({
      where: { id: assessment.id },
      data: { status: "DRAFT", paymentEntryId: null, confirmedAt: null, confirmedById: null },
    });
    return { ok: true as const };
  });
