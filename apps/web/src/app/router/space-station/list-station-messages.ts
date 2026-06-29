import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Lista as mensagens do Chat Geral da Station, paginadas por cursor (created_at).
 * Padrão: 50 últimas mensagens (DESC). Frontend exibe em ordem cronológica
 * invertendo a lista. `cursor` é o `createdAt` do item mais antigo já carregado.
 */
export const listStationMessages = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/list-station-messages",
    summary: "List Station general chat messages (paginated DESC by createdAt)",
  })
  .input(
    z.object({
      stationId: z.string(),
      cursor: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { stationId, cursor, limit = DEFAULT_LIMIT } = input;
    const userId = context.user.id;

    // Acesso: mesma lógica do send — owner ou member da org.
    const station = await prisma.spaceStation.findUnique({
      where: { id: stationId },
      select: { id: true, userId: true, orgId: true, isPublic: true },
    });
    if (!station) throw errors.NOT_FOUND({ message: "Station não encontrada" });

    const isOwner =
      station.userId === userId ||
      station.orgId === context.session.activeOrganizationId;
    if (!isOwner) {
      if (!station.orgId) {
        throw errors.FORBIDDEN({ message: "Sem permissão" });
      }
      const member = await prisma.member.findFirst({
        where: { userId, organizationId: station.orgId },
        select: { id: true },
      });
      if (!member) throw errors.FORBIDDEN({ message: "Sem permissão pra ler" });
    }

    const items = await prisma.stationMessage.findMany({
      where: {
        stationId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1, // pega 1 a mais pra detectar hasMore
      select: {
        id: true,
        senderId: true,
        senderName: true,
        senderImage: true,
        body: true,
        createdAt: true,
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

    return {
      messages: page,
      nextCursor,
      hasMore,
    };
  });
