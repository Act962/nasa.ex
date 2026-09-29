import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import z from "zod";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  AWAITING_REPLY_WHERE,
  NOT_AWAITING_REPLY_WHERE,
  formatBandCursor,
  parseBandCursor,
  type ConversationBand,
} from "@/features/tracking-chat/lib/conversation-awaiting-band";
import {
  CONVERSATION_CHANNEL_FILTERS,
  type ConversationChannelFilter,
} from "@/features/tracking-chat/utils/channel-filter";
import {
  buildCursorWhere,
  buildNextCursorValue,
  buildOrderBy,
  CONVERSATION_SORT_BY,
} from "@/features/tracking-chat/lib/conversation-list-order";


const sortOptions = z.enum(CONVERSATION_SORT_BY);
const sortDirections = z.enum(["asc", "desc"]);
const statusFlowValues = z.enum(["NEW", "ACTIVE", "WAITING", "FINISHED"]);
const temperatureValues = z.enum(["COLD", "WARM", "HOT", "VERY_HOT"]);

/**
 * Lista de conversas da sidebar do chat (spec 0011).
 *
 * Pagina por **keyset** (`cursorId` + `cursorValue`), não por
 * `cursor: { id }`. A forma antiga só funcionava porque a ordenação fixa
 * era `lastMessageAt`, que é `@updatedAt` e praticamente nunca empata —
 * com ordenação por data de chegada ou de entrada na etapa os empates
 * viram regra, e cursor por id sobre ordenação não-única repete e omite
 * registros.
 */

export const listConversation = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/conversation/list",
    summary: "List conversations",
  })
  .input(
    z.object({
      trackingId: z.string(),
      statusId: z.string().nullable(),
      search: z.string().nullable(),
      limit: z.number().min(1).max(100).optional(),
      /**
       * @deprecated Substituído por `cursorId` + `cursorValue` (spec 0011).
       * Mantido pra não quebrar client antigo em cache; é ignorado.
       */
      cursor: z.string().optional(),
      cursorId: z.string().optional(),
      cursorValue: z.string().optional(),
      /**
       * @deprecated Use `statusFlows` (multi). Mantido pra compat; quando
       * vier preenchido é somado ao array.
       */
      statusFlow: statusFlowValues.nullable().optional(),
      /** Filtro "Status" (spec 0011, RF-3). Vazio = esconde FINISHED (RF-5). */
      statusFlows: z.array(statusFlowValues).optional(),
      channel: z.enum(CONVERSATION_CHANNEL_FILTERS).nullable().optional(),
      tagIds: z.array(z.string()).optional(),
      favoritesOnly: z.boolean().optional(),
      /**
       * Quando `true`, mostra SOMENTE leads arquivados (filtro "Arquivados"
       * da sidebar). Quando `false`/undefined, EXCLUI arquivados do retorno.
       * Outros filtros (statusFlow, tags, etc.) seguem aplicando.
       */
      archivedOnly: z.boolean().optional(),
      /** Filtro "Responsável" — email, mesma chave do board (RF-1). */
      responsibleEmail: z.string().optional(),
      /** Filtro "Temperatura" (RF-2). */
      temperatures: z.array(temperatureValues).optional(),
      sortBy: sortOptions.default("lastMessageAt"),
      sortDirection: sortDirections.default("desc"),
    }),
  )

  .handler(async ({ input, context, errors }) => {
    try {
      const limit = input.limit ?? 30;

      // `statusFlow` (single, legado) e `statusFlows` (multi) convergem num
      // conjunto só. Vazio mantém o default histórico de esconder finalizados.
      const statusFlows = Array.from(
        new Set([
          ...(input.statusFlows ?? []),
          ...(input.statusFlow ? [input.statusFlow] : []),
        ]),
      );

      const filterWhere: Prisma.ConversationWhereInput = {
          trackingId: input.trackingId,
          ...buildChannelWhere(input.channel),
          lead: {
            // Arquivados: filtro orthogonal aos outros.
            // - `archivedOnly: true` → SOMENTE arquivados (filtro
            //   "Arquivados" da sidebar).
            // - Sem search ativo → exclui arquivados (`isArchived: false`).
            // - COM search ativo → não filtra (`undefined`), deixa
            //   arquivados aparecerem com badge visual no card. UX:
            //   busca acha o lead mesmo arquivado.
            ...(input.archivedOnly
              ? { isArchived: true }
              : input.search?.trim()
                ? {}
                : { isArchived: false }),
            ...(statusFlows.length
              ? { statusFlow: { in: statusFlows } }
              : { statusFlow: { not: "FINISHED" } }),
            ...(input.statusId && { statusId: input.statusId }),
            ...(input.responsibleEmail && {
              responsible: { email: input.responsibleEmail },
            }),
            ...(input.temperatures?.length && {
              temperature: { in: input.temperatures },
            }),
            ...(input.search && {
              OR: [
                {
                  name: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
                {
                  phone: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
              ],
            }),
            ...(input.tagIds?.length && {
              leadTags: { some: { tagId: { in: input.tagIds } } },
            }),
            ...(input.favoritesOnly && {
              leadTags: {
                some: {
                  tag: {
                    OR: [
                      { name: { contains: "favorit", mode: "insensitive" } },
                      { slug: { contains: "favorit", mode: "insensitive" } },
                      { name: { contains: "star", mode: "insensitive" } },
                      { slug: { contains: "star", mode: "insensitive" } },
                    ],
                  },
                },
              },
            }),
          },
        };

      const listInclude = {
          lastMessage: true,
          _count: {
            select: {
              messages: {
                where: {
                  seen: false,
                  fromMe: false,
                },
              },
            },
          },
          lead: {
            include: {
              leadTags: {
                include: {
                  tag: true,
                },
              },
              // Anel de temperatura no avatar da lista (spec 0035, RF-10).
              metrics: true,
              // Ícone de gatilho no card, girando se houver um ligado (spec 0038, RF-7).
              triggers: { select: { isActive: true } },
            },
          },
        } satisfies Prisma.ConversationInclude;

      const findConversations = (where: Prisma.ConversationWhereInput, take: number) =>
        prisma.conversation.findMany({
          where,
          include: listInclude,
          take,
          orderBy: buildOrderBy(input.sortBy, input.sortDirection),
        });

      // "Sem resposta primeiro" (opt-in no Ordenar): quem mandou mensagem e não
      // teve resposta vem antes — duas faixas por `lastMessageAt`, e o cursor
      // diz em qual delas a página anterior parou. A ordenação padrão segue
      // cronológica pura, como sempre foi.
      const isAwaitingFirst = input.sortBy === "awaitingReply";
      const band = isAwaitingFirst ? parseBandCursor(input.cursorValue) : null;
      const cursorValue = band ? band.value : input.cursorValue;
      const cursorWhere = buildCursorWhere(input.sortBy, input.sortDirection, input.cursorId, cursorValue);

      let conversations: Awaited<ReturnType<typeof findConversations>>;
      const awaitingIds = new Set<string>();
      if (!band) {
        conversations = await findConversations({ AND: [filterWhere, cursorWhere] }, limit + 1);
      } else if (band.band === "awaiting") {
        // +1 pra saber se existe próxima página sem precisar de count.
        const awaiting = await findConversations({ AND: [filterWhere, AWAITING_REPLY_WHERE, cursorWhere] }, limit + 1);
        awaiting.forEach((conversation) => awaitingIds.add(conversation.id));
        conversations =
          awaiting.length > limit
            ? awaiting
            : [...awaiting, ...(await findConversations({ AND: [filterWhere, NOT_AWAITING_REPLY_WHERE] }, limit + 1 - awaiting.length))];
      } else {
        conversations = await findConversations({ AND: [filterWhere, NOT_AWAITING_REPLY_WHERE, cursorWhere] }, limit + 1);
      }

      const hasMore = conversations.length > limit;
      const pageItems = hasMore ? conversations.slice(0, limit) : conversations;

      const newConversations = pageItems.map((conversation) => {
        const { _count, ...rest } = conversation;
        return {
          ...rest,
          unreadCount: _count.messages,
        };
      });

      const lastItem = pageItems[pageItems.length - 1];
      // A faixa do cursor é a do último item mostrado, não a da última busca.
      const lastBand: ConversationBand | null = band && lastItem ? (awaitingIds.has(lastItem.id) ? "awaiting" : "rest") : null;
      const nextCursorId = hasMore && lastItem ? lastItem.id : undefined;
      const nextCursorValue =
        hasMore && lastItem
          ? lastBand
            ? formatBandCursor(lastBand, buildNextCursorValue(input.sortBy, lastItem))
            : buildNextCursorValue(input.sortBy, lastItem)
          : undefined;

      return {
        items: newConversations,
        nextCursorId,
        nextCursorValue,
      };
    } catch (error) {
      // Antes o catch engolia a causa inteira, o que tornava impossível
      // diagnosticar erro de filtro/cursor sem repro local.
      console.error("[conversation.list] failed", error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

/**
 * Filtro de canal da lista. O "Chat do site" (In-Chat) é gravado como
 * WhatsApp; o que o identifica é o lead ter nascido no site
 * (`Lead.source = IN_CHAT`). Por isso WhatsApp exclui esses leads e In-Chat
 * filtra por eles. Canal desconhecido é ignorado em vez de quebrar a
 * consulta no enum (antes ia direto como `any`).
 */
function buildChannelWhere(
  channel: ConversationChannelFilter | null | undefined,
): Prisma.ConversationWhereInput {
  if (!channel) return {};
  if (channel === "IN_CHAT") return { AND: [{ lead: { source: "IN_CHAT" } }] };
  // Widget do ASTRO no site do cliente (spec 0031): mesmo padrão do In-Chat.
  if (channel === "ASTRO_CHAT") return { AND: [{ lead: { source: "ASTRO_CHAT" } }] };
  // Pedidos do Catálogo online do NERP chegam como lead.source NERP_CATALOG.
  if (channel === "CATALOG") return { AND: [{ lead: { source: "NERP_CATALOG" } }] };
  if (channel === "TIKTOK") return { AND: [{ lead: { source: "TIKTOK" } }] };
  if (channel === "WHATSAPP") {
    return {
      channel: "WHATSAPP",
      AND: [{ lead: { source: { notIn: ["IN_CHAT", "ASTRO_CHAT", "NERP_CATALOG"] } } }],
    };
  }
  if (channel === "INSTAGRAM" || channel === "FACEBOOK") return { channel };
  return {};
}
