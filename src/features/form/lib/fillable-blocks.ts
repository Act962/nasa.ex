/**
 * Quais blocos contam como "preenchíveis" para a barra de progresso e para
 * a validação de "grupo completo" no modo passo-a-passo.
 *
 * Regra: o bloco precisa ser categoria `Field` E não estar na lista de tipos
 * decorativos. Heading/Paragraph hoje são `Layout` (corrigido), mas mantemos
 * a deny-list por segurança para o caso de futuros blocos visuais que sejam
 * categorizados erroneamente como Field.
 */
import type { FormBlockType } from "@/features/form/types";

const NON_FILLABLE_TYPES = new Set<FormBlockType>([
  "Heading",
  "Paragraph",
  "ParagraphWithTitle",
  "ImageDisplay",
  "PageBreak",
  "QrCodeMulti",
]);

export function isFillableBlock(
  blockType: FormBlockType,
  blockCategory: "Layout" | "Field" | undefined,
): boolean {
  if (blockCategory !== "Field") return false;
  if (NON_FILLABLE_TYPES.has(blockType)) return false;
  return true;
}
