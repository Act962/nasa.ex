"use client";

import { createContext, useContext } from "react";
import type { FieldValue } from "@/features/form/types";

/**
 * Contexto opcional que alimenta valores iniciais nos blocos do formulário.
 * Usado no fluxo de "Continuar preenchimento" (`/formulario/[slug]/[responseId]`)
 * para que blocos como TextField/TextArea/RadioSelect/Dropdown/DatePicker/etc.
 * exibam o que já foi respondido anteriormente, em vez de aparecerem vazios.
 *
 * Cada chave é o `blockInstance.id` do bloco filho.
 *
 * - `usePrefillValue(blockId)` retorna a string `value` (compat com blocos
 *   simples como TextField/TextArea/RadioSelect/...).
 * - `usePrefillFieldValue(blockId)` retorna o `FieldValue` completo,
 *   incluindo `meta` com IDs/URLs/dataURL — usado pelos blocos compostos
 *   (UserSelect, FileUpload, ImageUpload, Signature).
 *
 * No fluxo público (submit-form), nenhum provider é montado e ambos os hooks
 * retornam `undefined` — o comportamento original (campos vazios) é preservado.
 */
export type PrefillFieldMap = Record<string, FieldValue | undefined>;

const FormPrefillContext = createContext<PrefillFieldMap | null>(null);

export function FormPrefillProvider({
  values,
  children,
}: {
  values: PrefillFieldMap;
  children: React.ReactNode;
}) {
  return (
    <FormPrefillContext.Provider value={values}>
      {children}
    </FormPrefillContext.Provider>
  );
}

/**
 * Lê o valor inicial salvo (string) para um bloco. Retorna undefined se não
 * houver provider ou se o bloco não tem valor pré-preenchido.
 */
export function usePrefillValue(blockId: string): string | undefined {
  const ctx = useContext(FormPrefillContext);
  if (!ctx) return undefined;
  return ctx[blockId]?.value;
}

/**
 * Lê o `FieldValue` completo (com `meta`) para um bloco. Útil para blocos
 * que precisam de IDs/URLs/dataURL salvos junto com o valor textual.
 */
export function usePrefillFieldValue(blockId: string): FieldValue | undefined {
  const ctx = useContext(FormPrefillContext);
  if (!ctx) return undefined;
  return ctx[blockId];
}

/**
 * Compat com a API antiga do contexto. Mantida pra eventuais imports
 * externos; os novos consumers usam `PrefillFieldMap`.
 */
export type PrefillMap = Record<string, string | undefined>;
