import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

// Teto de mensagens por export. Uma conversa muito longa não pode virar
// um findMany sem limite que puxa dezenas de milhares de linhas de uma vez.
// Ao atingir o teto, devolvemos as mais recentes e marcamos `truncated`.
const MAX_EXPORT_MESSAGES = 20000;

export const exportConversation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/message/export",
    summary: "Export conversation transcript",
    tags: ["Messages"],
  })
  .input(
    z
      .object({
        conversationId: z.string(),
        // Período opcional (ISO). Sem os dois, exporta a conversa inteira.
        dateInit: z.string().datetime().optional(),
        dateEnd: z.string().datetime().optional(),
      })
      .refine((value) => Boolean(value.dateInit) === Boolean(value.dateEnd), {
        message: "Informe o início e o fim do período",
      }),
  )
  .handler(async ({ input, context, errors }) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: {
        id: true,
        tracking: { select: { organizationId: true } },
        lead: { select: { name: true } },
      },
    });

    if (!conversation) {
      throw errors.NOT_FOUND({ message: "Conversa não encontrada" });
    }

    // Escopo de organização: sem isso, qualquer usuário autenticado leria a
    // conversa de outra empresa passando o id.
    if (conversation.tracking.organizationId !== context.org.id) {
      throw errors.FORBIDDEN({ message: "Sem permissão para esta conversa" });
    }

    const period =
      input.dateInit && input.dateEnd
        ? { from: new Date(input.dateInit), to: new Date(input.dateEnd) }
        : null;

    const messageWhere = {
      conversationId: conversation.id,
      ...(period && { createdAt: { gte: period.from, lte: period.to } }),
    };

    const total = await prisma.message.count({ where: messageWhere });

    const truncated = total > MAX_EXPORT_MESSAGES;

    // Quando passa do teto, pega as mais recentes (desc + take) e reordena
    // asc em memória — o relevante de um histórico gigante é o final.
    const rows = await prisma.message.findMany({
      where: messageWhere,
      select: {
        body: true,
        fromMe: true,
        senderName: true,
        createdAt: true,
        mediaType: true,
        mediaCaption: true,
        mimetype: true,
        fileName: true,
        latitude: true,
        longitude: true,
      },
      orderBy: [{ createdAt: truncated ? "desc" : "asc" }, { id: "desc" }],
      take: MAX_EXPORT_MESSAGES,
    });

    const messages = truncated ? rows.reverse() : rows;

    return {
      leadName: conversation.lead.name,
      organizationName: context.org.name,
      total,
      truncated,
      period,
      messages,
    };
  });
