import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import z from "zod";
import prisma from "@/lib/prisma";
import type { LeadSource, MessageChannel } from "@/generated/prisma/enums";
import {
  CONVERSATION_CHANNEL_FILTERS,
  type ConversationChannelFilter,
} from "@/features/tracking-chat/utils/channel-filter";

// Filtros que não existem em Conversation.channel viram filtro por origem do lead.
const LEAD_SOURCE_BY_CHANNEL_FILTER: Partial<
  Record<ConversationChannelFilter, LeadSource>
> = {
  CATALOG: "NERP_CATALOG",
  TIKTOK: "TIKTOK",
};

const MESSAGE_CHANNEL_BY_CHANNEL_FILTER: Partial<
  Record<ConversationChannelFilter, MessageChannel>
> = {
  WHATSAPP: "WHATSAPP",
  INSTAGRAM: "INSTAGRAM",
  FACEBOOK: "FACEBOOK",
};

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
      cursor: z.string().optional(),
      statusFlow: z
        .enum(["NEW", "ACTIVE", "WAITING", "FINISHED"])
        .nullable()
        .optional(),
      channel: z.enum(CONVERSATION_CHANNEL_FILTERS).nullable().optional(),
      tagIds: z.array(z.string()).optional(),
      favoritesOnly: z.boolean().optional(),
      /**
       * Quando `true`, mostra SOMENTE leads arquivados (filtro "Arquivados"
       * da sidebar). Quando `false`/undefined, EXCLUI arquivados do retorno.
       * Outros filtros (statusFlow, tags, etc.) seguem aplicando.
       */
      archivedOnly: z.boolean().optional(),
    }),
  )

  .handler(async ({ input, context, errors }) => {
    try {
      const limit = input.limit ?? 30;
      const messageChannel = input.channel
        ? MESSAGE_CHANNEL_BY_CHANNEL_FILTER[input.channel]
        : undefined;
      const leadSource = input.channel
        ? LEAD_SOURCE_BY_CHANNEL_FILTER[input.channel]
        : undefined;
      const conversations = await prisma.conversation.findMany({
        where: {
          trackingId: input.trackingId,
          ...(messageChannel && { channel: messageChannel }),
          lead: {
            ...(leadSource && { source: leadSource }),
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
            statusFlow: input.statusFlow
              ? { equals: input.statusFlow }
              : { not: "FINISHED" },
            ...(input.statusId && { statusId: input.statusId }),
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
        ...(input.cursor
          ? {
              cursor: { id: input.cursor },
              skip: 1,
            }
          : {}),
        take: limit,
        orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      });

      if (!conversations) {
        throw errors.BAD_REQUEST;
      }

      const newConversations = conversations.map((conversation) => {
        const { _count, ...rest } = conversation;
        return {
          ...rest,
          unreadCount: _count.messages,
        };
      });

      const nextCursor =
        conversations.length === limit
          ? conversations[conversations.length - 1].id
          : undefined;

      return {
        items: newConversations,
        nextCursor,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
