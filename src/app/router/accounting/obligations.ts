import { z } from "zod";
import prisma from "@/lib/prisma";
import { findDocumentType } from "@/features/accounting/lib/compliance/document-catalog";
import { syncFiscalObligations } from "@/features/accounting/server/obligations/sync-fiscal-obligations";
import { accountingReadProcedure, accountingWriteProcedure } from "./procedures";

const obligationShape = z.object({
  id: z.string(),
  kind: z.string(),
  label: z.string(),
  period: z.string(),
  dueDate: z.date(),
  status: z.enum(["PENDING", "DONE", "OVERDUE", "NOT_APPLICABLE"]),
  assessmentId: z.string().nullable(),
  completedAt: z.date().nullable(),
  glossaryTermId: z.string().nullable(),
  officialUrl: z.string().nullable(),
});

export const listAccountingObligations = accountingReadProcedure
  .route({ method: "GET", summary: "Calendário fiscal", tags: ["Accounting"] })
  .input(z.object({ from: z.string().optional(), to: z.string().optional(), refresh: z.boolean().optional() }).optional())
  .output(z.object({ obligations: z.array(obligationShape) }))
  .handler(async ({ input, context }) => {
    if (input?.refresh) await syncFiscalObligations(context.org.id);
    const from = input?.from ? new Date(input.from) : new Date(Date.now() - 90 * 86_400_000);
    const to = input?.to ? new Date(input.to) : new Date(Date.now() + 60 * 86_400_000);
    const obligations = await prisma.fiscalObligation.findMany({
      where: { organizationId: context.org.id, dueDate: { gte: from, lte: to } },
      orderBy: { dueDate: "asc" },
    });
    return {
      obligations: obligations.map((obligation) => {
        const documentType = findDocumentType(obligation.kind);
        return {
          id: obligation.id,
          kind: obligation.kind,
          label: documentType?.label ?? obligation.kind,
          period: obligation.period,
          dueDate: obligation.dueDate,
          status: obligation.status,
          assessmentId: obligation.assessmentId,
          completedAt: obligation.completedAt,
          glossaryTermId: documentType?.glossaryTermId ?? null,
          officialUrl: documentType?.officialLinks[0]?.url ?? null,
        };
      }),
    };
  });

export const setAccountingObligationStatus = accountingWriteProcedure
  .route({ method: "PATCH", summary: "Marca obrigação como feita ou não aplicável", tags: ["Accounting"] })
  .input(z.object({ obligationId: z.string(), status: z.enum(["DONE", "NOT_APPLICABLE", "PENDING"]) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const updated = await prisma.fiscalObligation.updateMany({
      where: { id: input.obligationId, organizationId: context.org.id },
      data: { status: input.status, completedAt: input.status === "PENDING" ? null : new Date() },
    });
    if (updated.count === 0) throw errors.NOT_FOUND({ message: "Obrigação não encontrada" });
    return { ok: true as const };
  });
