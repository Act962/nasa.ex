import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const handleAccessRequest = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/access-requests/handle",
    summary: "Admin: approve or reject a station access request",
  })
  .input(z.object({ requestId: z.string(), action: z.enum(["approve", "reject"]) }))
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    const orgId  = context.session.activeOrganizationId;
    if (!orgId) throw new Error("Organização ativa não definida");

    const req = await prisma.stationAccessRequest.findUnique({
      where: { id: input.requestId },
      include: { station: { select: { id: true, orgId: true } } },
    });
    if (!req) throw new Error("Pedido não encontrado");
    if (req.station.orgId !== orgId) throw new Error("Sem permissão para este pedido");

    const member = await prisma.member.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      select: { role: true },
    });
    if (!member) throw new Error("Sem permissão");

    const newStatus = input.action === "approve" ? "APPROVED" : "REJECTED";

    await prisma.$transaction(async (tx) => {
      await tx.stationAccessRequest.update({
        where: { id: req.id },
        data: { status: newStatus, decidedById: userId, decidedAt: new Date() },
      });
      if (input.action === "approve" && req.station.orgId) {
        // Cria Member como guest se ainda não existir
        await tx.member.upsert({
          where: { userId_organizationId: { userId: req.userId, organizationId: req.station.orgId } },
          update: {},
          create: {
            userId: req.userId,
            organizationId: req.station.orgId,
            role: "guest",
            createdAt: new Date(),
          },
        });
      }
    });

    return { status: newStatus };
  });
