import { parseItemListMeta, type PricedItem } from "./item-list-value";
import type { ParsedResponse, RecordBlock } from "./response-values";

// Projeção de uma ficha (spec 0075, RF-6): o que o `FormRecord` guarda para a
// lista, a busca e o fechamento não dependerem de reler o formulário.

export interface RecordKeyField {
  label: string;
  value: string;
  showInList: boolean;
}

export interface RecordProjection {
  /** nome-chave → campo. Só blocos com `attributes.fieldKey`. */
  keyFields: Record<string, RecordKeyField>;
  /** Valores dos campos pesquisáveis, sem acento e em minúsculas. */
  searchText: string;
  referenceDate: Date | null;
  usageItems: PricedItem[];
  usageTotalCents: number;
}

const FIELD_KEY_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

/** "Placa do Veículo" → "placa_do_veiculo": o nome-chave é digitado por gente. */
export function toFieldKey(rawKey: string): string {
  return rawKey
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function readFieldKey(block: RecordBlock): string | null {
  const fieldKey = block.attributes?.fieldKey;
  return typeof fieldKey === "string" && FIELD_KEY_PATTERN.test(fieldKey) ? fieldKey : null;
}

function readReferenceDate(entry: ParsedResponse[string] | undefined): Date | null {
  const iso = typeof entry?.meta?.iso === "string" ? entry.meta.iso : entry?.value;
  if (!iso) return null;
  // Data sem hora é meio-dia de Brasília: evita cair no dia anterior em UTC.
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00-03:00` : iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildRecordProjection(params: { blocks: RecordBlock[]; response: ParsedResponse }): RecordProjection {
  const keyFields: Record<string, RecordKeyField> = {};
  const searchParts: string[] = [];
  const usageItems: PricedItem[] = [];
  let usageTotalCents = 0;
  let referenceDate: Date | null = null;

  for (const block of params.blocks) {
    const entry = params.response[block.id];
    const attributes = block.attributes ?? {};

    const itemList = parseItemListMeta(entry?.meta);
    if (itemList) {
      usageItems.push(...itemList.items.filter((item) => item.billingMode === "USAGE"));
      usageTotalCents += itemList.usageTotalCents;
    }

    if (attributes.useAsReferenceDate === true && !referenceDate) referenceDate = readReferenceDate(entry);

    const value = entry?.value?.trim() ?? "";
    const fieldKey = readFieldKey(block);
    if (fieldKey && !(fieldKey in keyFields)) {
      keyFields[fieldKey] = {
        label: typeof attributes.label === "string" && attributes.label.trim() ? attributes.label.trim() : fieldKey,
        value,
        showInList: attributes.showInList === true,
      };
    }
    if (attributes.isSearchable === true && value) searchParts.push(value);
  }

  return {
    keyFields,
    searchText: normalizeSearchText(searchParts.join(" ")),
    referenceDate,
    usageItems,
    usageTotalCents,
  };
}

/** "2026-09" no fuso de Brasília — o período em que a ficha entra no fechamento. */
export function toPeriodKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  return `${year}-${month}`;
}
