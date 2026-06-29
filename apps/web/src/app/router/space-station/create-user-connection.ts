import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * POST /space-station/user-connections
 * Cria uma conexão bidirecional entre dois usuários e concede acesso às estações de cada um.
 * Chamado quando um usuário aceita um pedido de conexão (Conectar pessoas).
 */
export const createUserConnection = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/user-connections",
    summary: "Create a bidirectional user connection and grant mutual station access",
  })
  .input(z.object({ connectedUserId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const userId      = context.user.id;
    const connectedId = input.connectedUserId;

    if (userId === connectedId) throw new Error("Não é possível conectar consigo mesmo");

    // ── 1. Criar conexão bidirecional ────────────────────────────────
    await prisma.$transaction([
      prisma.userConnection.upsert({
        where:  { userId_connectedId: { userId, connectedId } },
        create: { userId, connectedId },
        update: {},
      }),
      prisma.userConnection.upsert({
        where:  { userId_connectedId: { userId: connectedId, connectedId: userId } },
        create: { userId: connectedId, connectedId: userId },
        update: {},
      }),
    ]);

    // ── 2. Conceder acesso às estações de cada usuário ────────────────
    const [stationA, stationB] = await Promise.all([
      prisma.spaceStation.findUnique({
        where:  { userId },
        select: { id: true },
      }),
      prisma.spaceStation.findUnique({
        where:  { userId: connectedId },
        select: { id: true },
      }),
    ]);

    if (stationA && stationB) {
      await prisma.$transaction([
        // connectedId pode visitar a estação de userId
        prisma.stationAccessRequest.upsert({
          where:  { stationId_userId: { stationId: stationA.id, userId: connectedId } },
          create: { stationId: stationA.id, userId: connectedId, status: "APPROVED" },
          update: { status: "APPROVED" },
        }),
        // userId pode visitar a estação de connectedId
        prisma.stationAccessRequest.upsert({
          where:  { stationId_userId: { stationId: stationB.id, userId } },
          create: { stationId: stationB.id, userId, status: "APPROVED" },
          update: { status: "APPROVED" },
        }),
      ]);
    }

    return { ok: true };
  });
