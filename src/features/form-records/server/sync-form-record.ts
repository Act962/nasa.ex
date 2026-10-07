import "server-only";
import prisma from "@/lib/prisma";
import { ITEM_LIST_BLOCK_TYPE } from "@/features/form-records/lib/item-list-value";
import { buildRecordProjection, toPeriodKey } from "@/features/form-records/lib/record-fields";
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
      block.attributes?.useAsReferenceDate === true,
  );
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
      select: { id: true, finalizedAt: true },
    });
    if (existing) {
      await prisma.formRecord.update({
        where: { id: existing.id },
        data: {
          ...projected,
          ...(params.isFinal && !existing.finalizedAt ? { finalizedAt: new Date() } : {}),
          ...(sourceRecordId ? { sourceRecordId } : {}),
        },
      });
      return;
    }
    await prisma.formRecord.create({
      data: {
        ...projected,
        organizationId: response.form.organizationId,
        formId: response.formId,
        responseId: response.id,
        finalizedAt: params.isFinal ? new Date() : null,
        sourceRecordId,
      },
    });
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
