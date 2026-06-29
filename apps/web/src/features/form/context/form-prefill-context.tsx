"use client";

import { createContext, useContext, useMemo } from "react";
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

type FormPrefillContextValue = {
  values: PrefillFieldMap;
  /**
   * Chave única por montagem do form, usada por blocos que persistem estado
   * em sessionStorage (ex: ImageUpload). Isola entre submissions diferentes
   * do mesmo form (mesmo `block.id`) — sem isso, ao abrir uma nova resposta
   * o sessionStorage da resposta anterior vazaria, restaurando imagens
   * antigas no campo vazio.
   */
  sessionKey: string;
};

const FormPrefillContext = createContext<FormPrefillContextValue | null>(null);

export function FormPrefillProvider({
  values,
  sessionKey,
  children,
}: {
  values: PrefillFieldMap;
  /**
   * Identificador único do "mount" do form. Quando o componente remonta
   * (ex: navegou pra outra resposta ou submeteu e voltou pro form novo),
   * a chave muda e o storage da sessão anterior é descartado.
   */
  sessionKey: string;
  children: React.ReactNode;
}) {
  const ctx = useMemo(
    () => ({ values, sessionKey }),
    [values, sessionKey],
  );
  return (
    <FormPrefillContext.Provider value={ctx}>
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
  return ctx.values[blockId]?.value;
}

/**
 * Lê o `FieldValue` completo (com `meta`) para um bloco. Útil para blocos
 * que precisam de IDs/URLs/dataURL salvos junto com o valor textual.
 */
export function usePrefillFieldValue(blockId: string): FieldValue | undefined {
  const ctx = useContext(FormPrefillContext);
  if (!ctx) return undefined;
  return ctx.values[blockId];
}

/**
 * Retorna a `sessionKey` única do mount atual do form. Quando não há
 * provider (fluxo público sem prefill), devolve uma string fixa — nesse
 * caso os blocos podem cair no padrão antigo (que era seguro pra um
 * único form preenchido sem submissions repetidas).
 */
export function useFormSessionKey(): string {
  const ctx = useContext(FormPrefillContext);
  return ctx?.sessionKey ?? "default";
}

/**
 * Compat com a API antiga do contexto. Mantida pra eventuais imports
 * externos; os novos consumers usam `PrefillFieldMap`.
 */
export type PrefillMap = Record<string, string | undefined>;
