import { z } from "zod";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";

// Visão do cliente (spec 0075, RF-11), sem login: o token do link identifica o
// lead e tudo é filtrado pelo id dele, resolvido aqui. Nunca devolve número de
// fichas nem custo total do período — revelariam o volume dos outros clientes.

const PERIOD_KEY = /^\d{4}-\d{2}$/;
const shareSchema = z.object({ groupId: z.string(), name: z.string(), cents: z.number() });

function readListedFields(rawKeyFields: unknown): { label: string; value: string }[] {
  if (!rawKeyFields || typeof rawKeyFields !== "object" || Array.isArray(rawKeyFields)) return [];
  return Object.values(rawKeyFields as Record<string, unknown>).flatMap((rawField) => {
    const field = rawField as { label?: unknown; value?: unknown; showInList?: unknown } | null;
    if (!field || field.showInList !== true || typeof field.label !== "string" || typeof field.value !== "string" || !field.value) {
      return [];
    }
    return [{ label: field.label, value: field.value }];
  });
}

export const listClientRecords = base
  .route({ method: "GET", summary: "Public list of the records of a lead, by its public token", tags: ["Forms"] })
  .input(z.object({ token: z.string().min(10), periodKey: z.string().regex(PERIOD_KEY).optional() }))
  .output(
    z.object({
      clientFirstName: z.string(),
      periodKey: z.string().nullable(),
      periodKeys: z.array(z.string()),
      records: z.array(
        z.object({
          responseId: z.string(),
          formName: z.string(),
          label: z.string().nullable(),
          referenceDate: z.string(),
          usageTotalCents: z.number(),
          fields: z.array(z.object({ label: z.string(), value: z.string() })),
        }),
      ),
      usageCents: z.number(),
      /** Uma entrada por formulário com período já fechado. Vazio = prévia. */
      closedSummaries: z.array(
        z.object({
          formName: z.string(),
          recordCount: z.number(),
          usageCents: z.number(),
          shares: z.array(shareSchema),
          totalCents: z.number(),
        }),
      ),
      /** Há ficha do período em formulário cujo fechamento ainda não saiu. */
      hasOpenPeriod: z.boolean(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const lead = await prisma.lead.findUnique({
      where: { publicToken: input.token },
      select: { id: true, name: true },
    });
    if (!lead) throw errors.NOT_FOUND({ message: "Link inválido" });

    // Rascunho não aparece para o cliente: ainda pode mudar.
    const scope = { leadId: lead.id, finalizedAt: { not: null } };
    const periodGroups = await prisma.formRecord.groupBy({
      by: ["periodKey"],
      where: scope,
      orderBy: { periodKey: "desc" },
    });
    const periodKeys = periodGroups.map((group) => group.periodKey);
    const periodKey = input.periodKey ?? periodKeys[0] ?? null;
    const clientFirstName = lead.name.split(" ")[0] || "Cliente";

    if (!periodKey) {
      return { clientFirstName, periodKey: null, periodKeys, records: [], usageCents: 0, closedSummaries: [], hasOpenPeriod: false };
    }

    const [records, closingLines] = await Promise.all([
      prisma.formRecord.findMany({
        where: { ...scope, periodKey },
        orderBy: [{ referenceDate: "desc" }, { createdAt: "desc" }],
        select: {
          responseId: true,
          formId: true,
          label: true,
          referenceDate: true,
          usageTotalCents: true,
          keyFields: true,
          form: { select: { name: true } },
          closing: { select: { status: true } },
        },
        take: 500,
      }),
      prisma.formClosingLine.findMany({
        where: { leadId: lead.id, closing: { periodKey, status: "CLOSED" } },
        select: {
          recordCount: true,
          usageCents: true,
          sharedCostShares: true,
          totalCents: true,
          closing: { select: { form: { select: { name: true } } } },
        },
      }),
    ]);

    return {
      clientFirstName,
      periodKey,
      periodKeys,
      records: records.map((record) => ({
        responseId: record.responseId,
        formName: record.form.name,
        label: record.label,
        referenceDate: record.referenceDate.toISOString(),
        usageTotalCents: record.usageTotalCents,
        fields: readListedFields(record.keyFields),
      })),
      usageCents: records.reduce((total, record) => total + record.usageTotalCents, 0),
      closedSummaries: closingLines.map((line) => {
        const shares = z.array(shareSchema).safeParse(line.sharedCostShares);
        return {
          formName: line.closing.form.name,
          recordCount: line.recordCount,
          usageCents: line.usageCents,
          shares: shares.success ? shares.data : [],
          totalCents: line.totalCents,
        };
      }),
      hasOpenPeriod: records.some((record) => record.usageTotalCents > 0 && record.closing?.status !== "CLOSED"),
    };
  });
