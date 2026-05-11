/**
 * Calcula o progresso de preenchimento de um formulário sendo respondido.
 *
 * Usado em:
 *  - `form-submit-component.tsx` (`/submit-form/<formId>` + `/formulario/<slug>`)
 *  - Painéis que mostram preview do form preenchido
 *
 * Diferente de `form-readiness.ts` (que valida o BUILDER do formulário),
 * aqui o foco é: **dos campos obrigatórios, quantos o lead já preencheu?**
 */

import type { FormBlockInstance, FieldValue } from "@/features/form/types";

export interface RequiredField {
  blockId: string;
  blockType: string;
  label: string;
}

export interface FillProgress {
  /** Total de campos obrigatórios no form. */
  totalRequired: number;
  /** Quantos já têm valor. */
  filledRequired: number;
  /** 0-100. Se totalRequired===0, retorna 100 (form sem obrigatórios). */
  percent: number;
  /** IDs dos campos obrigatórios FALTANDO. Pra destacar em vermelho. */
  missingIds: Set<string>;
  /** Lista detalhada dos faltantes (com label). */
  missing: RequiredField[];
}

/**
 * Considera um campo "preenchido" quando o value é:
 *  - string não vazia (após trim) → texto/email/data/etc.
 *  - array com pelo menos 1 elemento → multi-select
 *  - objeto com `dataUrl` ou `images` populado → assinatura/upload
 *  - número/boolean truthy
 */
function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.value === "string") return obj.value.trim().length > 0;
    if (Array.isArray(obj.images)) return obj.images.length > 0;
    if (typeof obj.dataUrl === "string") return obj.dataUrl.length > 0;
    return Object.keys(obj).length > 0;
  }
  return false;
}

export function computeFillProgress(
  blocks: FormBlockInstance[],
  formVals: Record<string, FieldValue>,
): FillProgress {
  const missing: RequiredField[] = [];
  const missingIds = new Set<string>();
  let totalRequired = 0;
  let filledRequired = 0;

  function visit(block: FormBlockInstance) {
    const required = !!block.attributes?.required;
    if (required) {
      totalRequired += 1;
      const v = formVals[block.id];
      // FieldValue.value pode ser string; se for não-string (ex: array),
      // chamamos isFilled no value direto.
      const filled = v ? isFilled(v.value) || isFilled(v.meta) : false;
      if (filled) {
        filledRequired += 1;
      } else {
        missingIds.add(block.id);
        missing.push({
          blockId: block.id,
          blockType: block.blockType,
          label:
            (block.attributes?.label as string | undefined)?.trim() ||
            block.blockType,
        });
      }
    }
    block.childblocks?.forEach(visit);
  }

  blocks.forEach(visit);

  const percent =
    totalRequired === 0
      ? 100
      : Math.round((filledRequired / totalRequired) * 100);

  return { totalRequired, filledRequired, percent, missingIds, missing };
}
