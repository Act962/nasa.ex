import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORBIT_LOOKUP_BLOCK_TYPE } from "@/features/form-records/lib/orbit-lookup-value";
import { toPeriodKey } from "@/features/form-records/lib/record-fields";
import { flattenBlocks } from "@/features/form-records/lib/response-values";
import { readKeyFieldValues } from "./lookup";

// Tela inicial das fichas (spec 0075, RF-16): junta o formulário de abertura e
// o que continua a partir dele (o que tem uma "Busca no Órbita" apontando para
// as fichas do primeiro), para mostrar o que ainda falta preencher.

const LIST_SIZE = 30;
const FOLLOW_UP_CANDIDATES = 10;

const workspaceFormSchema = z.object({ id: z.string(), name: z.string() });

const workspaceRecordSchema = z.object({
  id: z.string(),
  responseId: z.string(),
  title: z.string(),
  detail: z.string(),
  leadId: z.string().nullable(),
  leadName: z.string().nullable(),
  referenceDate: z.string(),
  usageTotalCents: z.number(),
  isFinalized: z.boolean(),
});

const RECORD_SELECT = {
  id: true,
  responseId: true,
  label: true,
  leadId: true,
  referenceDate: true,
  usageTotalCents: true,
  finalizedAt: true,
  keyFields: true,
} as const;

function readSourceFormId(jsonBlock: unknown): string | null {
  for (const block of flattenBlocks(jsonBlock)) {
    if (block.blockType !== ORBIT_LOOKUP_BLOCK_TYPE) continue;
    const { source, sourceFormId } = block.attributes ?? {};
    if (source === "RECORDS" && typeof sourceFormId === "string" && sourceFormId) return sourceFormId;
  }
  return null;
}

export const getFormWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Home of a records form: what is pending and what is done", tags: ["Forms"] })
  .input(z.object({ formId: z.string() }))
  .output(
    z.object({
      /** Formulário que abre o atendimento (ex.: Abertura de O.S.). */
      openingForm: workspaceFormSchema,
      /** Formulário que continua a partir do de abertura; `null` quando o formulário anda sozinho. */
      followUpForm: workspaceFormSchema.nullable(),
      /** Onde ficam os itens cobrados: é dele o fechamento por cliente. */
      closingFormId: z.string(),
      /** Fichas de abertura que ainda não têm a ficha seguinte. */
      pendingRecords: z.array(workspaceRecordSchema),
      pendingCount: z.number(),
      completedRecords: z.array(workspaceRecordSchema),
      completedCount: z.number(),
      /** Clientes com ficha, para enviar o link de acompanhamento. */
      clients: z.array(z.object({ id: z.string(), name: z.string(), phone: z.string().nullable(), recordCount: z.number() })),
      periodKeys: z.array(z.string()),
      /** Números do mês corrente (Brasília). */
      monthSummary: z.object({
        periodKey: z.string(),
        openedCount: z.number(),
        completedCount: z.number(),
        usageCents: z.number(),
        clientCount: z.number(),
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

    let openingForm = { id: form.id, name: form.name };
    let followUpForm: { id: string; name: string } | null = null;

    const sourceFormId = readSourceFormId(form.jsonBlock);
    const sourceForm = sourceFormId
      ? await prisma.form.findFirst({ where: { id: sourceFormId, organizationId }, select: { id: true, name: true } })
      : null;
    if (sourceForm) {
      openingForm = sourceForm;
      followUpForm = { id: form.id, name: form.name };
    } else {
      const candidates = await prisma.form.findMany({
        where: { organizationId, id: { not: form.id }, jsonBlock: { contains: form.id } },
        select: { id: true, name: true, jsonBlock: true },
        orderBy: { createdAt: "asc" },
        take: FOLLOW_UP_CANDIDATES,
      });
      const followUp = candidates.find((candidate) => readSourceFormId(candidate.jsonBlock) === form.id);
      if (followUp) followUpForm = { id: followUp.id, name: followUp.name };
    }

    const completedFormId = followUpForm?.id ?? openingForm.id;
    const formIds = [...new Set([openingForm.id, completedFormId])];

    const continuedRecords = followUpForm
      ? await prisma.formRecord.findMany({
          where: { organizationId, formId: followUpForm.id, sourceRecordId: { not: null } },
          select: { sourceRecordId: true },
          distinct: ["sourceRecordId"],
        })
      : [];
    const continuedRecordIds = continuedRecords
      .map((record) => record.sourceRecordId)
      .filter((recordId): recordId is string => recordId !== null);
    const pendingWhere = { organizationId, formId: openingForm.id, id: { notIn: continuedRecordIds } };
    const completedWhere = { organizationId, formId: completedFormId };
    const recentFirst = [{ referenceDate: "desc" as const }, { createdAt: "desc" as const }];

    const currentPeriodKey = toPeriodKey(new Date());
    const monthScope = { organizationId, periodKey: currentPeriodKey };

    const [pendingRecords, pendingCount, completedRecords, completedCount, leadGroups, periodGroups, monthOpenedCount, monthCompleted, monthLeadGroups] = await Promise.all([
      followUpForm ? prisma.formRecord.findMany({ where: pendingWhere, orderBy: recentFirst, take: LIST_SIZE, select: RECORD_SELECT }) : [],
      followUpForm ? prisma.formRecord.count({ where: pendingWhere }) : 0,
      prisma.formRecord.findMany({ where: completedWhere, orderBy: recentFirst, take: LIST_SIZE, select: RECORD_SELECT }),
      prisma.formRecord.count({ where: completedWhere }),
      prisma.formRecord.groupBy({ by: ["leadId"], where: { organizationId, formId: { in: formIds } }, _count: { _all: true } }),
      prisma.formRecord.groupBy({ by: ["periodKey"], where: { organizationId, formId: { in: formIds } }, orderBy: { periodKey: "desc" } }),
      prisma.formRecord.count({ where: { ...monthScope, formId: openingForm.id } }),
      prisma.formRecord.aggregate({ where: { ...monthScope, formId: completedFormId }, _count: { _all: true }, _sum: { usageTotalCents: true } }),
      prisma.formRecord.groupBy({ by: ["leadId"], where: { ...monthScope, formId: { in: formIds }, leadId: { not: null } } }),
    ]);

    const recordCountByLeadId = new Map<string, number>();
    for (const group of leadGroups) if (group.leadId) recordCountByLeadId.set(group.leadId, group._count._all);
    const leads =
      recordCountByLeadId.size > 0
        ? await prisma.lead.findMany({
            where: { id: { in: [...recordCountByLeadId.keys()] }, tracking: { organizationId } },
            select: { id: true, name: true, phone: true },
            orderBy: { name: "asc" },
          })
        : [];
    const leadNameById = new Map(leads.map((lead) => [lead.id, lead.name]));

    const toWorkspaceRecord = (record: (typeof completedRecords)[number]) => {
      const fieldValues = Object.values(readKeyFieldValues(record.keyFields));
      const title = record.label?.trim() || fieldValues[0] || "Ficha sem título";
      const leadName = record.leadId ? (leadNameById.get(record.leadId) ?? null) : null;
      // O título e o cliente já aparecem na linha: o detalhe traz só o que falta.
      const detailValues = fieldValues.filter((fieldValue) => fieldValue !== title && fieldValue !== leadName);
      return {
        id: record.id,
        responseId: record.responseId,
        title,
        detail: detailValues.slice(0, 3).join(" · "),
        leadId: record.leadId,
        leadName,
        referenceDate: record.referenceDate.toISOString(),
        usageTotalCents: record.usageTotalCents,
        isFinalized: record.finalizedAt !== null,
      };
    };

    return {
      openingForm,
      followUpForm,
      closingFormId: completedFormId,
      pendingRecords: pendingRecords.map(toWorkspaceRecord),
      pendingCount,
      completedRecords: completedRecords.map(toWorkspaceRecord),
      completedCount,
      clients: leads.map((lead) => ({ id: lead.id, name: lead.name, phone: lead.phone, recordCount: recordCountByLeadId.get(lead.id) ?? 0 })),
      periodKeys: periodGroups.map((group) => group.periodKey),
      monthSummary: {
        periodKey: currentPeriodKey,
        openedCount: monthOpenedCount,
        completedCount: monthCompleted._count._all,
        usageCents: monthCompleted._sum.usageTotalCents ?? 0,
        clientCount: monthLeadGroups.length,
      },
    };
  });
