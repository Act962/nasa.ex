import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const requestStationAccess = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/access-request",
    summary: "Submit (or refresh) an access request to a Space Station",
  })
  .input(z.object({ stationId: z.string(), message: z.string().max(500).optional() }))
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    const station = await prisma.spaceStation.findUnique({
      where: { id: input.stationId },
      select: { id: true, accessMode: true, orgId: true },
    });
    if (!station) throw new Error("Station not found");
    if (station.accessMode !== "REQUEST") {
      throw new Error("Esta station não aceita pedidos de acesso");
    }
    // se já é membro da org, devolve sucesso direto
    if (station.orgId) {
      const m = await prisma.member.findUnique({
        where: { userId_organizationId: { userId, organizationId: station.orgId } },
        select: { id: true },
      });
      if (m) return { status: "MEMBER" as const };
    }
    const req = await prisma.stationAccessRequest.upsert({
      where: { stationId_userId: { stationId: station.id, userId } },
      update: { message: input.message, status: "PENDING", decidedAt: null, decidedById: null },
      create: { stationId: station.id, userId, message: input.message },
      select: { id: true, status: true, createdAt: true },
    });
    return { status: req.status, requestId: req.id, createdAt: req.createdAt };
  });
