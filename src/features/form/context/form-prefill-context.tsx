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

/**
 * Fontes que um bloco pode vincular via `attributes.prefillFromLead`
 * (spec 0006). São exatamente os campos do step de identificação.
 */
export type LeadPrefillSource = "name" | "email" | "phone";

/**
 * Valores vivos do step de identificação. `phone` vem no formato EXIBIDO
 * (com máscara e DDI), não no normalizado do banco — o campo do corpo do
 * formulário deve mostrar o mesmo que o usuário digitou (spec 0006, RF-8).
 */
export type LeadIdentityValues = Partial<Record<LeadPrefillSource, string>>;

type FormPrefillContextValue = {
  values: PrefillFieldMap;
  /**
   * Ausente quando a identificação não está ativa. Um bloco vinculado a uma
   * fonte inexistente nasce vazio, sem erro (spec 0006, CB-1/CB-2).
   */
  identity: LeadIdentityValues;
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
  identity,
  sessionKey,
  children,
}: {
  values: PrefillFieldMap;
  /** Valores do step de identificação; omitido quando não há identificação. */
  identity?: LeadIdentityValues;
  /**
   * Identificador único do "mount" do form. Quando o componente remonta
   * (ex: navegou pra outra resposta ou submeteu e voltou pro form novo),
   * a chave muda e o storage da sessão anterior é descartado.
   */
  sessionKey: string;
  children: React.ReactNode;
}) {
  const ctx = useMemo(
    () => ({ values, identity: identity ?? {}, sessionKey }),
    [values, identity, sessionKey],
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
 * Valor vivo de uma fonte da identificação. `undefined` quando não há provider
 * ou quando aquela fonte não está sendo coletada.
 */
export function useLeadIdentityValue(
  source: LeadPrefillSource | null | undefined,
): string | undefined {
  const ctx = useContext(FormPrefillContext);
  if (!ctx || !source) return undefined;
  const value = ctx.identity[source];
  return value && value.trim().length > 0 ? value : undefined;
}

/**
 * Resolve o valor inicial de um bloco na ordem definida pela spec 0006, D-3:
 *
 *   valor salvo (por blockId) → identificação → vazio
 *
 * O valor salvo vem primeiro porque é uma resposta real já dada; sobrescrevê-la
 * com o dado da identificação apagaria trabalho do usuário em silêncio.
 *
 * Devolve também `identityValue` para que o bloco possa acompanhar mudanças na
 * identificação enquanto o campo não foi editado à mão (D-4).
 */
export function useResolvedInitialValue(
  blockId: string,
  source: LeadPrefillSource | null | undefined,
): { initialValue: string | undefined; identityValue: string | undefined } {
  const savedValue = usePrefillValue(blockId);
  const identityValue = useLeadIdentityValue(source);
  const hasSaved = savedValue !== undefined && savedValue.trim().length > 0;
  return {
    initialValue: hasSaved ? savedValue : identityValue,
    identityValue,
  };
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
