import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import z from "zod";
import prisma from "@/lib/prisma";
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
      channel: z.string().nullable().optional(),
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

      const conversations = await prisma.conversation.findMany({
        where: {
          trackingId: input.trackingId,
          ...(input.channel && { channel: input.channel as any }),
          ...buildCursorWhere(
            input.sortBy,
            input.sortDirection,
            input.cursorId,
            input.cursorValue,
          ),
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
        },
        include: {
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
            },
          },
        },
        // +1 pra saber se existe próxima página sem precisar de count.
        take: limit + 1,
        orderBy: buildOrderBy(input.sortBy, input.sortDirection),
      });

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
      const nextCursorId = hasMore && lastItem ? lastItem.id : undefined;
      const nextCursorValue =
        hasMore && lastItem
          ? buildNextCursorValue(input.sortBy, lastItem)
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
