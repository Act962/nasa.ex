/**
 * Vocabulário compartilhado dos filtros da lista de conversas (spec 0011).
 *
 * Vive fora dos componentes porque três lugares precisam concordar: a
 * query da sidebar, o handler de realtime que mexe no cache dessa mesma
 * query, e a UI dos filtros. Quando a `queryKey` era montada à mão nos
 * dois primeiros, elas já tinham divergido — o realtime omitia
 * `archivedOnly`, então a atualização otimista caía num cache diferente e
 * o chat só se atualizava pelo refetch de invalidação.
 */

export const CONVERSATION_STATUS_FLOWS = [
  { value: "NEW", label: "Novo lead", color: "#8b5cf6" },
  { value: "ACTIVE", label: "Em atendimento", color: "#22c55e" },
  { value: "WAITING", label: "Aguardando atendimento", color: "#f59e0b" },
  { value: "FINISHED", label: "Finalizado", color: "#6b7280" },
] as const;

export type ConversationStatusFlow =
  (typeof CONVERSATION_STATUS_FLOWS)[number]["value"];

export const CONVERSATION_TEMPERATURES = [
  { value: "COLD", label: "Gelo", color: "#3498db" },
  { value: "WARM", label: "Morna", color: "#f1c40f" },
  { value: "HOT", label: "Quente", color: "#e67e22" },
  { value: "VERY_HOT", label: "Muito Quente", color: "#e74c3c" },
] as const;

export type ConversationTemperature =
  (typeof CONVERSATION_TEMPERATURES)[number]["value"];

/**
 * Critérios de ordenação. "Data de interação" é a última mensagem da
 * conversa, não `Lead.updatedAt` como no board — num chat, interação é
 * mensagem (spec 0011, D-4). É também o default histórico, o que mantém a
 * lista idêntica pra quem não mexe em nada.
 */
export const CONVERSATION_SORT_OPTIONS = [
  { value: "lastMessageAt", label: "Data de interação" },
  { value: "statusEnteredAt", label: "Data de entrada na etapa" },
  { value: "leadCreatedAt", label: "Data de chegada" },
] as const;

export type ConversationSortBy =
  (typeof CONVERSATION_SORT_OPTIONS)[number]["value"];

export const CONVERSATION_SORT_DIRECTIONS = [
  { value: "desc", label: "Do mais recente para o mais antigo" },
  { value: "asc", label: "Do mais antigo para o mais recente" },
] as const;

export type ConversationSortDirection =
  (typeof CONVERSATION_SORT_DIRECTIONS)[number]["value"];

export const DEFAULT_CONVERSATION_SORT_BY: ConversationSortBy = "lastMessageAt";
export const DEFAULT_CONVERSATION_SORT_DIRECTION: ConversationSortDirection =
  "desc";

/**
 * Só a ordenação default reflete "mensagem nova sobe pro topo". Nas
 * outras, mover a conversa pro topo mentiria sobre a ordem pedida
 * (spec 0011, CB-10).
 */
export function sortKeepsNewestOnTop(
  sortBy: ConversationSortBy,
  sortDirection: ConversationSortDirection,
): boolean {
  return (
    sortBy === DEFAULT_CONVERSATION_SORT_BY &&
    sortDirection === DEFAULT_CONVERSATION_SORT_DIRECTION
  );
}

export interface ConversationListFilters {
  trackingId: string;
  statusId: string | null;
  search: string | null;
  statusFlows: ConversationStatusFlow[];
  channel: string;
  tagIds: string[];
  favoritesOnly: boolean;
  archivedOnly: boolean;
  responsibleEmail: string | null;
  temperatures: ConversationTemperature[];
  sortBy: ConversationSortBy;
  sortDirection: ConversationSortDirection;
}

/**
 * Indica se a lista está estreitada por algum critério que o payload do
 * Pusher não carrega.
 *
 * `conversationProps` (o corpo do evento `conversation:new`) traz só dados
 * da conversa — nada de responsável, temperatura, status ou etiquetas do
 * lead. Sem isso não dá pra decidir no cliente se a conversa nova pertence
 * à lista filtrada, então a inserção otimista deixa de ser segura e quem
 * decide passa a ser o servidor, via invalidação.
 */
export function listHasNarrowingFilters(
  filters: ConversationListFilters,
): boolean {
  return Boolean(
    filters.search?.trim() ||
      filters.statusId ||
      filters.statusFlows.length ||
      (filters.channel && filters.channel !== "ALL") ||
      filters.tagIds.length ||
      filters.favoritesOnly ||
      filters.archivedOnly ||
      filters.responsibleEmail ||
      filters.temperatures.length,
  );
}

/**
 * Indica se uma mensagem nova altera a própria chave de ordenação.
 *
 * Só acontece em `lastMessageAt`. Em `statusEnteredAt` e `leadCreatedAt` a
 * mensagem não muda o campo ordenado, então manter a conversa no lugar é o
 * comportamento certo e não precisa de refetch.
 */
export function newMessageChangesSortKey(sortBy: ConversationSortBy): boolean {
  return sortBy === "lastMessageAt";
}

/**
 * Descarta valor que não pertence à lista conhecida. A URL é editável à
 * mão e chega crua do board, então sanitizamos antes de mandar pro
 * servidor — senão um `?temperature=BANANA` derruba a lista inteira no
 * Zod em vez de ser simplesmente ignorado (spec 0011, CB-8).
 */
export function parseCsvOptions<T extends string>(
  raw: string | null,
  allowed: ReadonlyArray<{ value: T }>,
): T[] {
  if (!raw) return [];
  const allowedValues = new Set<string>(allowed.map((option) => option.value));
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is T => allowedValues.has(value));
}



/**
 * Fonte única da `queryKey` da lista. Qualquer filtro novo entra aqui e
 * os três consumidores acompanham automaticamente.
 */
export function buildConversationsListQueryKey(
  filters: ConversationListFilters,
): unknown[] {
  return [
    "conversations.list",
    filters.trackingId,
    filters.statusId,
    filters.search,
    filters.statusFlows,
    filters.channel,
    filters.tagIds,
    filters.favoritesOnly,
    filters.archivedOnly,
    filters.responsibleEmail,
    filters.temperatures,
    filters.sortBy,
    filters.sortDirection,
  ];
}
