/**
 * Achata a árvore de blocos do form (`jsonBlock`, com `childblocks` aninhados)
 * numa lista plana de CAMPOS PREENCHÍVEIS em ordem de DOM. Fonte única para: o
 * compositor de título, o picker de imagem de capa e o fallback de label no
 * server que gera a action.
 *
 * Puro/isomórfico — sem import de React nem do registry de blocos (que arrasta
 * client components). A "preenchibilidade" é decidida por deny-list de tipos
 * layout/decorativos, espelhando `isFillableBlock` sem depender da categoria
 * (que não vem no bloco instanciado).
 */
import type { FormBlockType } from "@/features/form/types";

const NON_FILLABLE_TYPES = new Set<FormBlockType>([
  "RowLayout",
  "Heading",
  "Paragraph",
  "ParagraphWithTitle",
  "ImageDisplay",
  "PageBreak",
  "QrCodeMulti",
]);

export type FillableField = {
  id: string;
  label: string;
  blockType: FormBlockType;
  /** true quando o campo aceita múltiplos valores (ex.: ImageUpload multi). */
  multiple: boolean;
  /** true quando o campo é de preenchimento obrigatório. */
  required: boolean;
};

type AnyBlock = {
  id?: unknown;
  blockType?: unknown;
  attributes?: { label?: unknown; multiple?: unknown; required?: unknown };
  childblocks?: unknown;
};

function parseBlocks(jsonBlock: unknown): AnyBlock[] {
  if (Array.isArray(jsonBlock)) return jsonBlock as AnyBlock[];
  if (typeof jsonBlock === "string") {
    try {
      const parsed = JSON.parse(jsonBlock);
      return Array.isArray(parsed) ? (parsed as AnyBlock[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function labelFor(block: AnyBlock, blockType: FormBlockType): string {
  const label = block.attributes?.label;
  if (typeof label === "string" && label.trim()) return label.trim();
  return blockType;
}

function walk(blocks: AnyBlock[], out: FillableField[]): void {
  for (const block of blocks) {
    const blockType = block?.blockType as FormBlockType | undefined;
    if (
      typeof block?.id === "string" &&
      typeof blockType === "string" &&
      !NON_FILLABLE_TYPES.has(blockType)
    ) {
      out.push({
        id: block.id,
        label: labelFor(block, blockType),
        blockType,
        multiple: block.attributes?.multiple === true,
        required: block.attributes?.required === true,
      });
    }
    if (Array.isArray(block?.childblocks)) {
      walk(block.childblocks as AnyBlock[], out);
    }
  }
}

/** Lista os campos preenchíveis do form em ordem de DOM. */
export function listFillableFields(jsonBlock: unknown): FillableField[] {
  const out: FillableField[] = [];
  walk(parseBlocks(jsonBlock), out);
  return out;
}
