import { z } from "zod";
import prisma from "@/lib/prisma";
import { loadRegularityScore } from "@/features/accounting/server/compliance/load-regularity";
import { findDocumentType } from "@/features/accounting/lib/compliance/document-catalog";
import { accountingReadProcedure, accountingWriteProcedure } from "./procedures";

const itemShape = z.object({
  typeCode: z.string(),
  label: z.string(),
  group: z.string(),
  scope: z.string(),
  weight: z.number(),
  status: z.enum(["OK", "EXPIRING_SOON", "MISSING", "EXPIRED", "OVERDUE"]),
  expiresAt: z.date().nullable(),
  daysToExpire: z.number().nullable(),
  documentId: z.string().nullable(),
  openPeriods: z.array(z.string()),
  impactBps: z.number(),
  blockingImpact: z.string().nullable(),
  glossaryTermId: z.string().nullable(),
  officialUrl: z.string().nullable(),
  description: z.string(),
});

export const getRegularityScore = accountingReadProcedure
  .route({ method: "GET", summary: "Score de regularidade", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .output(
    z.object({
      scoreBps: z.number(),
      applicableCount: z.number(),
      okCount: z.number(),
      items: z.array(itemShape),
      blockingCount: z.number(),
      previousScoreBps: z.number().nullable(),
    }),
  )
  .handler(async ({ context }) => {
    const score = await loadRegularityScore(context.org.id);
    const monthAgo = new Date(Date.now() - 30 * 86_400_000);
    const previous = await prisma.regularityScoreSnapshot.findFirst({
      where: { organizationId: context.org.id, date: { lte: monthAgo } },
      orderBy: { date: "desc" },
      select: { scoreBps: true },
    });
    return {
      scoreBps: score.scoreBps,
      applicableCount: score.applicableCount,
      okCount: score.okCount,
      blockingCount: score.blockingItems.length,
      previousScoreBps: previous?.scoreBps ?? null,
      items: score.items.map((item) => {
        const documentType = findDocumentType(item.typeCode);
        return {
          ...item,
          glossaryTermId: documentType?.glossaryTermId ?? null,
          officialUrl: documentType?.officialLinks[0]?.url ?? null,
          description: documentType?.description ?? "",
        };
      }),
    };
  });

export const getRegularityHistory = accountingReadProcedure
  .route({ method: "GET", summary: "Histórico do score de regularidade", tags: ["Accounting"] })
  .input(z.object({ days: z.number().int().min(7).max(365).default(90) }).optional())
  .output(z.object({ points: z.array(z.object({ date: z.date(), scoreBps: z.number() })) }))
  .handler(async ({ input, context }) => {
    const since = new Date(Date.now() - (input?.days ?? 90) * 86_400_000);
    const points = await prisma.regularityScoreSnapshot.findMany({
      where: { organizationId: context.org.id, date: { gte: since } },
      orderBy: { date: "asc" },
      select: { date: true, scoreBps: true },
    });
    return { points };
  });

/** Liga/desliga um documento do catálogo para a empresa, ou ajusta peso/validade. */
export const setDocumentRequirement = accountingWriteProcedure
  .route({ method: "PUT", summary: "Ajusta um documento do catálogo", tags: ["Accounting"] })
  .input(
    z.object({
      typeCode: z.string().max(60),
      isApplicable: z.boolean().nullable().optional(),
      weight: z.number().int().min(1).max(3).nullable().optional(),
      defaultValidityDays: z.number().int().min(1).max(3650).nullable().optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (!findDocumentType(input.typeCode)) throw errors.BAD_REQUEST({ message: "Documento desconhecido" });
    const { typeCode, ...data } = input;
    await prisma.companyDocumentRequirement.upsert({
      where: { organizationId_typeCode: { organizationId: context.org.id, typeCode } },
      create: { organizationId: context.org.id, typeCode, ...data },
      update: data,
    });
    return { ok: true as const };
  });
