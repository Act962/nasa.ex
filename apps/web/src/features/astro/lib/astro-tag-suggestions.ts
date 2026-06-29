/**
 * Payload de sugestões de tag renderizável pelo Astro.
 *
 * Quando o Closer chama a tool `propose_tags_for_lead`, ela retorna esse
 * shape. O `astro-message.tsx` detecta via `kind: "astro_tag_suggestions"`
 * e renderiza um <AstroTagSuggestionsCard> interativo — checkboxes pro
 * usuário escolher quais aplicar.
 *
 * Apply usa o router HUMANO (`orpc.leads.addTags` via `useAddTags`) — full
 * audit (LeadHistory + LeadEvent + ActivityLog) + dispatch de workflows
 * LEAD_TAGGED + event bus, igual ao botão manual de tag.
 */
export type AstroTagSuggestion = {
  tagId: string;
  tagName: string;
  tagColor?: string;
  /** 1 frase curta justificando a sugestão com base na conversa. */
  reason: string;
};

export type AstroTagSuggestionsPayload = {
  kind: "astro_tag_suggestions";
  leadId: string;
  trackingId: string;
  suggestions: AstroTagSuggestion[];
  /**
   * Tags que o modelo sugeriu mas foram filtradas server-side
   * (não existem no catálogo da org/tracking OU o lead já as tem).
   */
  skipped?: Array<{
    tagId: string;
    reason: "not_in_catalog" | "already_applied";
  }>;
};

/** Type guard usado pelo renderer pra detectar o payload. */
export function isAstroTagSuggestionsPayload(
  value: unknown,
): value is AstroTagSuggestionsPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "astro_tag_suggestions" &&
    typeof (value as { leadId?: unknown }).leadId === "string" &&
    typeof (value as { trackingId?: unknown }).trackingId === "string" &&
    Array.isArray((value as { suggestions?: unknown }).suggestions)
  );
}
