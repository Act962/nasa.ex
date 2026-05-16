/**
 * Payload de tabela renderizável pelo Astro.
 *
 * Quando uma tool quer que o cliente mostre uma LISTA clicável (em vez
 * de só prosa), retorna esse shape. O `astro-message.tsx` detecta via
 * `kind: "astro_table"` e renderiza um <AstroDataTable> interativo —
 * cada linha vira link pra rota canônica da entidade.
 *
 * Convenção:
 * - `entityType`: define como construir a URL de cada linha.
 * - `rows[*].id` é obrigatório.
 * - `rows[*]` pode trazer campos extras usados na URL (ex: leads precisam
 *   só de `id`; actions precisam de `workspaceId` pra montar a query).
 * - `columns` define a ordem + label das colunas. Cada col aponta pra um
 *   campo de `rows[*]` via `key`.
 */
export type AstroTableEntityType =
  | "lead"
  | "action"
  | "appointment"
  | "proposal"
  | "conversation"
  | "tracking"
  | "agenda";

export interface AstroTableColumn {
  key: string;
  label: string;
  /**
   * Tipo do valor — orienta o render:
   *  - "text" (default): string como veio
   *  - "badge": pinta com borda/cor (status, prioridade)
   *  - "date": formata `Intl.DateTimeFormat("pt-BR")`
   *  - "currency": número em centavos → R$ formatado
   *  - "number": número com toLocaleString
   */
  type?: "text" | "badge" | "date" | "currency" | "number";
}

export interface AstroTableRow {
  id: string;
  /** Campos referenciados pelas colunas + qualquer extra que a URL precise. */
  [key: string]: string | number | boolean | null | undefined;
}

export interface AstroTablePayload {
  kind: "astro_table";
  entityType: AstroTableEntityType;
  title: string;
  /** Texto curto exibido acima da tabela explicando o que é. */
  caption?: string;
  columns: AstroTableColumn[];
  rows: AstroTableRow[];
  /** Total de itens encontrados (caso rows seja paginado). */
  totalCount?: number;
}

/**
 * Constrói a URL de detalhe pra cada entityType.
 * Atualiza aqui quando rotas mudarem — único lugar.
 */
export function buildEntityHref(
  entityType: AstroTableEntityType,
  row: AstroTableRow,
): string | null {
  switch (entityType) {
    case "lead":
      return `/contatos/${row.id}`;
    case "action":
      // Action mora num workspace. Sem workspaceId não dá pra deep-link.
      if (!row.workspaceId) return null;
      return `/workspaces/${row.workspaceId}?actionId=${row.id}`;
    case "tracking":
      return `/tracking/${row.id}`;
    case "agenda":
      return `/agendas/${row.id}`;
    case "appointment":
      // Não tem deep-link próprio — abre na agenda dele
      if (!row.agendaId) return null;
      return `/agendas/${row.agendaId}`;
    case "conversation":
      if (!row.trackingId) return null;
      return `/tracking/${row.trackingId}/chat/${row.id}`;
    case "proposal":
      // Sem deep-link interno pra proposta hoje — abre o app forge
      return `/forge`;
    default:
      return null;
  }
}

/** Type guard usado pelo renderer pra detectar o payload. */
export function isAstroTablePayload(value: unknown): value is AstroTablePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "astro_table" &&
    Array.isArray((value as { rows?: unknown }).rows) &&
    Array.isArray((value as { columns?: unknown }).columns)
  );
}
