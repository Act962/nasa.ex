import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";

/**
 * GET /space-station/user-connections
 * Retorna a lista de usuários com quem o usuário atual tem conexão bidirecional.
 */
export const listMyConnections = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/space-station/user-connections",
    summary: "List all users connected to the current user",
  })
  .handler(async ({ context }) => {
    const userId = context.user.id;

    const connections = await prisma.userConnection.findMany({
      where: { userId },
      select: {
        connectedId: true,
        createdAt:   true,
        connected: {
          select: {
            id:       true,
            name:     true,
            nickname: true,
            image:    true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return connections.map(c => ({
      userId:      c.connectedId,
      name:        c.connected.name    ?? c.connectedId,
      nick:        c.connected.nickname ?? null,
      image:       c.connected.image    ?? null,
      connectedAt: c.createdAt,
    }));
  });
