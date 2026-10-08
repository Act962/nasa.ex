import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { normalizeSearchText } from "@/features/form-records/lib/record-fields";
import { summarizeRecords, toDateRangeBounds } from "@/features/form-records/lib/records-summary";
import { flattenBlocks } from "@/features/form-records/lib/response-values";

// Lista de fichas de um formulário (spec 0075, RF-9): colunas vindas dos campos
// marcados como "mostrar na lista", total por ficha e soma do filtro.

const PAGE_SIZE = 50;
const PERIOD_KEY = /^\d{4}-\d{2}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
// O painel soma no máximo este número de fichas do filtro; acima disso avisa que é parcial.
const SUMMARY_RECORD_LIMIT = 5000;

function readListColumns(jsonBlock: unknown): { key: string; label: string }[] {
  const columns: { key: string; label: string }[] = [];
  for (const block of flattenBlocks(jsonBlock)) {
    const attributes = block.attributes ?? {};
    if (attributes.showInList !== true || typeof attributes.fieldKey !== "string") continue;
    if (columns.some((column) => column.key === attributes.fieldKey)) continue;
    columns.push({
      key: attributes.fieldKey,
      label: typeof attributes.label === "string" && attributes.label.trim() ? attributes.label.trim() : attributes.fieldKey,
    });
  }
  return columns;
}

function readKeyFieldValues(rawKeyFields: unknown): Record<string, string> {
  if (!rawKeyFields || typeof rawKeyFields !== "object" || Array.isArray(rawKeyFields)) return {};
  const values: Record<string, string> = {};
  for (const [fieldKey, rawField] of Object.entries(rawKeyFields as Record<string, unknown>)) {
    const value = (rawField as { value?: unknown } | null)?.value;
    if (typeof value === "string") values[fieldKey] = value;
  }
  return values;
}

export const listFormRecords = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List the records (fichas) of a form", tags: ["Forms"] })
  .input(
    z.object({
      formId: z.string(),
      periodKey: z.string().regex(PERIOD_KEY).optional(),
      /** Intervalo de dias de Brasília, os dois inclusivos. */
      dateFrom: z.string().regex(DATE_ONLY).optional(),
      dateTo: z.string().regex(DATE_ONLY).optional(),
      leadId: z.string().optional(),
      leadMemberId: z.string().optional(),
      search: z.string().trim().max(80).optional(),
      page: z.coerce.number().int().positive().default(1),
    }),
  )
  .output(
    z.object({
      formName: z.string(),
      columns: z.array(z.object({ key: z.string(), label: z.string() })),
      records: z.array(
        z.object({
          id: z.string(),
          responseId: z.string(),
          label: z.string().nullable(),
          leadId: z.string().nullable(),
          leadName: z.string().nullable(),
          /** Vinculado do lead a quem a ficha se refere (spec 0076). */
          leadMemberName: z.string().nullable(),
          referenceDate: z.string(),
          usageTotalCents: z.number(),
          isFinalized: z.boolean(),
          isClosed: z.boolean(),
          values: z.record(z.string(), z.string()),
        }),
      ),
      total: z.number(),
      usageSumCents: z.number(),
      pageSize: z.number(),
      /** Períodos que têm ficha, do mais novo para o mais antigo. */
      periodKeys: z.array(z.string()),
      /** Clientes que têm ficha neste formulário, para o filtro. */
      clients: z.array(z.object({ id: z.string(), name: z.string() })),
      /** Vinculados que têm ficha neste formulário, para a coluna e o filtro. */
      members: z.array(z.object({ id: z.string(), name: z.string(), leadId: z.string() })),
      /** Painel do filtro atual. */
      summary: z.object({
        recordCount: z.number(),
        usageCents: z.number(),
        averageUsageCents: z.number(),
        clientCount: z.number(),
        draftCount: z.number(),
        sentCount: z.number(),
        closedCount: z.number(),
        granularity: z.enum(["day", "month"]),
        buckets: z.array(z.object({ key: z.string(), recordCount: z.number(), usageCents: z.number() })),
        topClients: z.array(z.object({ id: z.string(), name: z.string(), recordCount: z.number(), usageCents: z.number() })),
        topMembers: z.array(z.object({ id: z.string(), name: z.string(), recordCount: z.number(), usageCents: z.number() })),
        topItems: z.array(z.object({ name: z.string(), unit: z.string(), quantity: z.number(), totalCents: z.number() })),
        isPartial: z.boolean(),
      }),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const form = await prisma.form.findFirst({
      where: { id: input.formId, organizationId },
      select: { id: true, name: true, jsonBlock: true },
    });
    if (!form) throw errors.NOT_FOUND({ message: "Formulário não encontrado" });

    const scope = { organizationId, formId: form.id };
    const dateBounds = toDateRangeBounds(input.dateFrom, input.dateTo);
    const where = {
      ...scope,
      ...(input.periodKey ? { periodKey: input.periodKey } : {}),
      ...(dateBounds.gte || dateBounds.lt ? { referenceDate: dateBounds } : {}),
      ...(input.leadId ? { leadId: input.leadId } : {}),
      ...(input.leadMemberId ? { leadMemberId: input.leadMemberId } : {}),
      ...(input.search ? { searchText: { contains: normalizeSearchText(input.search) } } : {}),
    };

    const [records, total, usageSum, periodGroups, leadGroups, memberGroups, summaryRecords] = await Promise.all([
      prisma.formRecord.findMany({
        where,
        orderBy: [{ referenceDate: "desc" }, { createdAt: "desc" }],
        skip: (input.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          responseId: true,
          label: true,
          leadId: true,
          leadMemberId: true,
          referenceDate: true,
          usageTotalCents: true,
          finalizedAt: true,
          keyFields: true,
          closing: { select: { status: true } },
        },
      }),
      prisma.formRecord.count({ where }),
      prisma.formRecord.aggregate({ where, _sum: { usageTotalCents: true } }),
      prisma.formRecord.groupBy({ by: ["periodKey"], where: scope, orderBy: { periodKey: "desc" } }),
      prisma.formRecord.groupBy({ by: ["leadId"], where: scope }),
      prisma.formRecord.groupBy({ by: ["leadMemberId"], where: { ...scope, leadMemberId: { not: null } } }),
      prisma.formRecord.findMany({
        where,
        orderBy: [{ referenceDate: "desc" }, { createdAt: "desc" }],
        take: SUMMARY_RECORD_LIMIT,
        select: {
          referenceDate: true,
          leadId: true,
          leadMemberId: true,
          usageTotalCents: true,
          finalizedAt: true,
          usageItems: true,
          closing: { select: { status: true } },
        },
      }),
    ]);

    const leadIds = leadGroups.map((group) => group.leadId).filter((leadId): leadId is string => leadId !== null);
    const leads =
      leadIds.length > 0
        ? await prisma.lead.findMany({
            where: { id: { in: leadIds }, tracking: { organizationId } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : [];
    const leadNameById = new Map(leads.map((lead) => [lead.id, lead.name]));

    const memberIds = memberGroups.map((group) => group.leadMemberId).filter((memberId): memberId is string => memberId !== null);
    const members =
      memberIds.length > 0
        ? await prisma.leadMember.findMany({
            where: { id: { in: memberIds }, organizationId },
            select: { id: true, name: true, leadId: true },
            orderBy: { name: "asc" },
          })
        : [];
    const memberNameById = new Map(members.map((member) => [member.id, member.name]));

    return {
      formName: form.name,
      columns: readListColumns(form.jsonBlock),
      records: records.map((record) => ({
        id: record.id,
        responseId: record.responseId,
        label: record.label,
        leadId: record.leadId,
        leadName: record.leadId ? (leadNameById.get(record.leadId) ?? null) : null,
        leadMemberName: record.leadMemberId ? (memberNameById.get(record.leadMemberId) ?? null) : null,
        referenceDate: record.referenceDate.toISOString(),
        usageTotalCents: record.usageTotalCents,
        isFinalized: record.finalizedAt !== null,
        isClosed: record.closing?.status === "CLOSED",
        values: readKeyFieldValues(record.keyFields),
      })),
      total,
      usageSumCents: usageSum._sum.usageTotalCents ?? 0,
      pageSize: PAGE_SIZE,
      periodKeys: periodGroups.map((group) => group.periodKey),
      clients: leads,
      members,
      summary: {
        ...summarizeRecords({
          records: summaryRecords.map((record) => ({
            referenceDate: record.referenceDate,
            leadId: record.leadId,
            leadMemberId: record.leadMemberId,
            usageTotalCents: record.usageTotalCents,
            isFinalized: record.finalizedAt !== null,
            isClosed: record.closing?.status === "CLOSED",
            usageItems: record.usageItems,
          })),
          leadNameById,
          memberNameById,
        }),
        isPartial: total > summaryRecords.length,
      },
    };
  });
