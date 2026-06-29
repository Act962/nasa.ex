/**
 * Configuração do botão "Próximo" no modo passo-a-passo do form.
 * Quando o usuário clica em "Próximo" no ÚLTIMO grupo (= submit), pode:
 *  - next_block: avançar para o próximo bloco normal (default — comportamento original)
 *  - form: abrir outro formulário, levando os dados do lead criado
 *  - external_link: redirecionar pra URL externa (com leadId/token na query)
 *  - add_tag: aplicar uma tag ao lead recém-criado e seguir o fluxo padrão
 */
export type NextButtonActionType =
  | "next_block"
  | "form"
  | "external_link"
  | "add_tag";

export type NextButtonAction = {
  type: NextButtonActionType;
  formId?: string | null;
  externalUrl?: string | null;
  tagId?: string | null;
  passLeadData?: boolean; // default true — adiciona ?leadId=...&leadToken=... ao destino
};

export const DEFAULT_NEXT_BUTTON_ACTION: NextButtonAction = {
  type: "next_block",
  passLeadData: true,
};

/**
 * Lê do JSON de settings.nextButtonAction com fallback robusto.
 */
export function resolveNextButtonAction(raw: unknown): NextButtonAction {
  if (!raw || typeof raw !== "object") return DEFAULT_NEXT_BUTTON_ACTION;
  const r = raw as Partial<NextButtonAction>;
  const type = (r.type ?? "next_block") as NextButtonActionType;
  if (
    type !== "next_block" &&
    type !== "form" &&
    type !== "external_link" &&
    type !== "add_tag"
  ) {
    return DEFAULT_NEXT_BUTTON_ACTION;
  }
  return {
    type,
    formId: r.formId ?? null,
    externalUrl: r.externalUrl ?? null,
    tagId: r.tagId ?? null,
    passLeadData: r.passLeadData !== false, // default true
  };
}

/**
 * Anexa parâmetros de identificação do lead à URL de destino.
 * Usado tanto pra abrir outro formulário quanto pra link externo.
 */
export function appendLeadParams(
  url: string,
  lead: { id?: string | null; publicToken?: string | null; email?: string | null; name?: string | null; phone?: string | null },
): string {
  if (!url) return url;
  try {
    const u = new URL(url, "https://placeholder.local");
    if (lead.id) u.searchParams.set("leadId", lead.id);
    if (lead.publicToken) u.searchParams.set("leadToken", lead.publicToken);
    if (lead.email) u.searchParams.set("email", lead.email);
    if (lead.name) u.searchParams.set("name", lead.name);
    if (lead.phone) u.searchParams.set("phone", lead.phone);
    // Mantém path/origem original; se foi parseada com placeholder, devolve só o path+search
    if (u.origin === "https://placeholder.local") {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    return u.toString();
  } catch {
    // URL inválida — devolve original
    return url;
  }
}
