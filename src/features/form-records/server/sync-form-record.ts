import "server-only";
import prisma from "@/lib/prisma";
import { ITEM_LIST_BLOCK_TYPE } from "@/features/form-records/lib/item-list-value";
import {
  buildRecordProjection,
  hasNextDateField,
  resolveNextDueAt,
  toPeriodKey,
} from "@/features/form-records/lib/record-fields";
import { parseOrbitLookupMeta } from "@/features/form-records/lib/orbit-lookup-value";
import {
  flattenBlocks,
  parseResponse,
  type ParsedResponse,
  type RecordBlock,
} from "@/features/form-records/lib/response-values";

// Mantém o `FormRecord` da resposta em dia (spec 0075, RF-6). Roda depois da
// gravação, fora de transação, e nunca lança: a ficha é uma projeção — falha
// aqui (inclusive tabela ainda não migrada) não pode derrubar o salvamento.

/** Só formulário que usa algum recurso de ficha ganha projeção. */
function isRecordForm(blocks: RecordBlock[]): boolean {
  return blocks.some(
    (block) =>
      block.blockType === ITEM_LIST_BLOCK_TYPE ||
      typeof block.attributes?.fieldKey === "string" ||
      block.attributes?.useAsReferenceDate === true ||
      block.attributes?.useAsNextDate === true,
  );
}

/**
 * Fichas do mesmo ITEM neste formulário (spec 0081, RF-4): as que puxaram a mesma ficha de origem.
 * Sem origem, as do mesmo cliente com o mesmo rótulo ("Ar da sala") — só o cliente não basta, ou o
 * atendimento do ar do escritório apagaria o prazo do ar do quarto. `null` = ficha solta, sem item
 * nem cliente: não se compara a nada.
 */
function sameItemScope(record: {
  organizationId: string;
  formId: string;
  sourceRecordId: string | null;
  leadId: string | null;
  label: string | null;
}) {
  const base = { organizationId: record.organizationId, formId: record.formId };
  if (record.sourceRecordId) return { ...base, sourceRecordId: record.sourceRecordId };
  if (!record.leadId) return null;
  const label = record.label?.trim();
  return {
    ...base,
    leadId: record.leadId,
    sourceRecordId: null,
    label: label ? { equals: label, mode: "insensitive" as const } : null,
  };
}

/**
 * Vale a próxima data da ficha finalizada mais recente de cada item. Sem isto, o atendimento já
 * feito continuaria aparecendo como previsto. Devolve a data que ESTA ficha deve guardar e limpa
 * a das anteriores.
 */
async function settleNextDueAt(params: {
  recordId: string;
  createdAt: Date;
  nextDueAt: Date | null;
  itemScope: ReturnType<typeof sameItemScope>;
}): Promise<Date | null> {
  if (!params.nextDueAt || !params.itemScope) return params.nextDueAt;
  const newerRecord = await prisma.formRecord.findFirst({
    where: { ...params.itemScope, id: { not: params.recordId }, finalizedAt: { not: null }, createdAt: { gt: params.createdAt } },
    select: { id: true },
  });
  // Ficha antiga reeditada: quem manda é a mais nova, então esta fica sem próxima data.
  if (newerRecord) return null;
  await prisma.formRecord.updateMany({
    where: { ...params.itemScope, id: { not: params.recordId }, nextDueAt: { not: null }, createdAt: { lt: params.createdAt } },
    data: { nextDueAt: null },
  });
  return params.nextDueAt;
}

/** Ficha de origem: a escolhida numa "Busca no Órbita" de fichas, se for da mesma organização. */
async function resolveSourceRecordId(response: ParsedResponse, organizationId: string): Promise<string | null> {
  for (const entry of Object.values(response)) {
    const lookup = parseOrbitLookupMeta(entry.meta);
    if (lookup?.source !== "RECORDS" || !lookup.refId) continue;
    const sourceRecord = await prisma.formRecord.findFirst({
      where: { id: lookup.refId, organizationId },
      select: { id: true },
    });
    if (sourceRecord) return sourceRecord.id;
  }
  return null;
}

export async function syncFormRecord(params: {
  responseId: string;
  /** Envio final: marca a ficha como finalizada (rascunho não entra no fechamento). */
  isFinal: boolean;
}): Promise<void> {
  try {
    const response = await prisma.formResponses.findUnique({
      where: { id: params.responseId },
      select: {
        id: true,
        formId: true,
        leadId: true,
        leadMemberId: true,
        label: true,
        createdAt: true,
        jsonResponse: true,
        form: { select: { organizationId: true, jsonBlock: true } },
      },
    });
    if (!response) return;

    const blocks = flattenBlocks(response.form.jsonBlock);
    if (!isRecordForm(blocks)) return;

    const parsedResponse = parseResponse(response.jsonResponse);
    const projection = buildRecordProjection({ blocks, response: parsedResponse });
    const sourceRecordId = await resolveSourceRecordId(parsedResponse, response.form.organizationId);
    const referenceDate = projection.referenceDate ?? response.createdAt;
    const projected = {
      leadId: response.leadId,
      leadMemberId: response.leadMemberId,
      label: response.label,
      referenceDate,
      periodKey: toPeriodKey(referenceDate),
      keyFields: projection.keyFields as object,
      searchText: [projection.searchText, response.label?.toLowerCase() ?? ""].filter(Boolean).join(" "),
      usageItems: projection.usageItems as unknown as object,
      usageTotalCents: projection.usageTotalCents,
    };

    const existing = await prisma.formRecord.findUnique({
      where: { responseId: response.id },
      select: { id: true, finalizedAt: true, sourceRecordId: true, createdAt: true },
    });
    const isFinalized = params.isFinal || Boolean(existing?.finalizedAt);
    // Só ficha finalizada tem próxima data: rascunho não entra em "previstas" (spec 0081, RF-3).
    const projectedNextDueAt = isFinalized && hasNextDateField(blocks) ? resolveNextDueAt(projection, referenceDate) : null;
    const itemScope = sameItemScope({
      organizationId: response.form.organizationId,
      formId: response.formId,
      sourceRecordId: sourceRecordId ?? existing?.sourceRecordId ?? null,
      leadId: response.leadId,
      label: response.label,
    });

    if (existing) {
      const nextDueAt = await settleNextDueAt({ recordId: existing.id, createdAt: existing.createdAt, nextDueAt: projectedNextDueAt, itemScope });
      await prisma.formRecord.update({
        where: { id: existing.id },
        data: {
          ...projected,
          nextDueAt,
          ...(params.isFinal && !existing.finalizedAt ? { finalizedAt: new Date() } : {}),
          ...(sourceRecordId ? { sourceRecordId } : {}),
        },
      });
      return;
    }
    const created = await prisma.formRecord.create({
      data: {
        ...projected,
        organizationId: response.form.organizationId,
        formId: response.formId,
        responseId: response.id,
        finalizedAt: params.isFinal ? new Date() : null,
        sourceRecordId,
      },
      select: { id: true, createdAt: true },
    });
    const nextDueAt = await settleNextDueAt({ recordId: created.id, createdAt: created.createdAt, nextDueAt: projectedNextDueAt, itemScope });
    if (nextDueAt) await prisma.formRecord.update({ where: { id: created.id }, data: { nextDueAt } });
  } catch (error) {
    console.warn("[form-records] projeção da ficha falhou", { responseId: params.responseId, error });
  }
}

/** A ficha entrou num período já fechado? Então não pode mais mudar. */
export async function isRecordLockedByClosing(responseId: string): Promise<boolean> {
  try {
    const record = await prisma.formRecord.findUnique({
      where: { responseId },
      select: { closing: { select: { status: true } } },
    });
    return record?.closing?.status === "CLOSED";
  } catch (error) {
    console.warn("[form-records] checagem de fechamento falhou", { responseId, error });
    return false;
  }
}

export const RECORD_LOCKED_MESSAGE =
  "Esta ficha entrou num período já fechado e não pode mais ser alterada. Reabra o fechamento para editar.";
