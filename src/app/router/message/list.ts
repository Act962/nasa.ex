import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import z from "zod";
import { Message } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

export const listMessage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/message/list",
    summary: "List messages",
  })
  .input(
    z.object({
      conversationId: z.string(),
      limit: z.number().min(1).max(100).optional(),
      cursor: z.string().optional(),
    }),
  )
  .output(
    z.object({
      items: z.array(
        z.custom<
          Message & {
            sender: { id: string; name: string };
          }
        >(),
      ),
      nextCursor: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: {
          id: input.conversationId,
        },
        include: {
          lead: true,
        },
      });

      if (!conversation) {
        throw errors.BAD_REQUEST;
      }

      const limit = input.limit ?? 30;

      const messages = await prisma.message.findMany({
        where: {
          conversationId: input.conversationId,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });

      const nextCursor =
        messages.length === limit
          ? messages[messages.length - 1].id
          : undefined;

      return {
        items: messages,
        nextCursor,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
