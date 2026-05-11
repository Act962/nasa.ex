"use client";

import { createContext, useContext } from "react";

/**
 * Contexto que expõe metadados do lead/form atual para blocos que precisam
 * referenciar o lead em runtime — ex: o `QrCodeMulti` que gera links de
 * acompanhamento (`/lead/<token>`) e edição (`/formulario/novo/<formId>/<leadId>`).
 *
 * Páginas internas (`/formulario/[slug]/[responseId]` e
 * `/formulario/novo/[formId]/[leadId]`) montam o provider com os dados
 * do lead atual. O `submit-form/[formId]` PÚBLICO NÃO monta — o lead
 * pode nem existir ainda. Blocos que dependem desse contexto degradam
 * graciosamente quando ele está vazio.
 */
export type FormLeadCtx = {
  leadId: string | null;
  /** publicToken usado em `/lead/<token>`. */
  leadPublicToken: string | null;
  /** ID do form atual — usado em `/formulario/novo/<formId>/<leadId>`. */
  formId: string | null;
};

const FormLeadContext = createContext<FormLeadCtx | null>(null);

export function FormLeadProvider({
  value,
  children,
}: {
  value: FormLeadCtx;
  children: React.ReactNode;
}) {
  return (
    <FormLeadContext.Provider value={value}>
      {children}
    </FormLeadContext.Provider>
  );
}

export function useFormLeadContext(): FormLeadCtx {
  const ctx = useContext(FormLeadContext);
  return ctx ?? { leadId: null, leadPublicToken: null, formId: null };
}
