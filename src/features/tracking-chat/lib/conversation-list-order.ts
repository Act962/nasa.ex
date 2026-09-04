import type { Prisma } from "@/generated/prisma/client";

/**
 * Ordenação e paginação por keyset da lista de conversas (spec 0011).
 *
 * Fica fora do handler oRPC por dois motivos: a regra é do domínio, não do
 * transporte (CLAUDE.md item 3), e assim dá pra exercitar as cláusulas
 * diretamente, que é onde mora o risco — cursor por `id` sobre ordenação
 * não-única repete e omite registros, e nulos de `statusEnteredAt` são
 * uma faixa própria que o keyset precisa atravessar.
 */

export const CONVERSATION_SORT_BY = [
  /** `Conversation.lastMessageAt` — "Data de interação" no chat (D-4). */
  "lastMessageAt",
  /** `Lead.statusEnteredAt` — "Data de entrada na etapa". Nullable. */
  "statusEnteredAt",
  /** `Lead.createdAt` — "Data de chegada". */
  "leadCreatedAt",
] as const;

export type ConversationSortBy = (typeof CONVERSATION_SORT_BY)[number];
export type ConversationSortDirection = "asc" | "desc";

/**
 * Marcador de "o cursor parou na faixa de `statusEnteredAt` nulo".
 * Nunca colide com um ISO date, que é o outro formato possível.
 */
export const NULL_CURSOR_VALUE = "null";

/**
 * Desempate único e estável em todas as ordenações — sem ele, duas linhas
 * com o mesmo valor podem trocar de posição entre páginas e sumir.
 */
const TIE_BREAKER: Prisma.ConversationOrderByWithRelationInput = { id: "asc" };

export function buildOrderBy(
  sortBy: ConversationSortBy,
  direction: ConversationSortDirection,
): Prisma.ConversationOrderByWithRelationInput[] {
  if (sortBy === "leadCreatedAt") {
    return [{ lead: { createdAt: direction } }, TIE_BREAKER];
  }
  if (sortBy === "statusEnteredAt") {
    // Leads anteriores ao campo têm `statusEnteredAt` nulo. Mandamos pro
    // fim nas DUAS direções (Postgres faria NULLS FIRST no DESC), pra que
    // a faixa nula seja sempre a última — é o que permite o cursor tratá-la
    // como uma segunda fase (CB-2).
    return [
      { lead: { statusEnteredAt: { sort: direction, nulls: "last" } } },
      TIE_BREAKER,
    ];
  }
  return [{ lastMessageAt: direction }, TIE_BREAKER];
}

/**
 * Cláusula que avança o keyset a partir da última linha da página anterior.
 *
 * Para uma coluna X e desempate por `id` crescente:
 *   desc → (X < v) OU (X = v E id > cursorId)
 *   asc  → (X > v) OU (X = v E id > cursorId)
 *
 * `statusEnteredAt` tem uma fase extra por causa dos nulos (D-2): enquanto
 * o cursor está na faixa não-nula, os nulos ainda estão todos por vir;
 * quando entra na faixa nula, só resta desempatar por `id`.
 *
 * O resultado sai **embrulhado em `AND`** de propósito. A fase dos nulos
 * precisa restringir `lead`, e o `where` do handler já tem uma chave
 * `lead` própria com os filtros da UI — espalhar as duas no mesmo objeto
 * faz a segunda sobrescrever a primeira em silêncio, o cursor perde a
 * restrição e a paginação volta ao começo em loop. Aconteceu: contra os
 * dados reais deu 25.181 conversas duplicadas antes do embrulho. Com
 * `AND`, a ordem do spread no caller deixa de importar.
 */
export function buildCursorWhere(
  sortBy: ConversationSortBy,
  direction: ConversationSortDirection,
  cursorId?: string,
  cursorValue?: string,
): Prisma.ConversationWhereInput {
  const clause = buildCursorClause(sortBy, direction, cursorId, cursorValue);
  return clause ? { AND: [clause] } : {};
}

function buildCursorClause(
  sortBy: ConversationSortBy,
  direction: ConversationSortDirection,
  cursorId?: string,
  cursorValue?: string,
): Prisma.ConversationWhereInput | null {
  if (!cursorId || !cursorValue) return null;

  const comparison = direction === "desc" ? "lt" : "gt";

  if (sortBy === "leadCreatedAt") {
    const value = new Date(cursorValue);
    return {
      OR: [
        { lead: { createdAt: { [comparison]: value } } },
        { lead: { createdAt: value }, id: { gt: cursorId } },
      ],
    };
  }

  if (sortBy === "statusEnteredAt") {
    if (cursorValue === NULL_CURSOR_VALUE) {
      return {
        lead: { statusEnteredAt: null },
        id: { gt: cursorId },
      };
    }
    const value = new Date(cursorValue);
    return {
      OR: [
        { lead: { statusEnteredAt: { [comparison]: value } } },
        { lead: { statusEnteredAt: value }, id: { gt: cursorId } },
        // A faixa nula vem inteira depois da não-nula.
        { lead: { statusEnteredAt: null } },
      ],
    };
  }

  const value = new Date(cursorValue);
  return {
    OR: [
      { lastMessageAt: { [comparison]: value } },
      { lastMessageAt: value, id: { gt: cursorId } },
    ],
  };
}

/**
 * Valor do keyset da próxima página, na mesma coluna da ordenação — é o
 * que impede o cursor de comparar uma coluna com outra.
 */
export function buildNextCursorValue(
  sortBy: ConversationSortBy,
  conversation: {
    lastMessageAt: Date;
    lead: { createdAt: Date; statusEnteredAt: Date | null };
  },
): string {
  if (sortBy === "leadCreatedAt") {
    return conversation.lead.createdAt.toISOString();
  }
  if (sortBy === "statusEnteredAt") {
    return conversation.lead.statusEnteredAt?.toISOString() ?? NULL_CURSOR_VALUE;
  }
  return conversation.lastMessageAt.toISOString();
}
