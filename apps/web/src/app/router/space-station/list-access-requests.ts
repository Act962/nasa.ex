import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const listAccessRequests = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/space-station/access-requests",
    summary: "Admin: list pending access requests for the active organization's station",
  })
  .input(z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional() }))
  .handler(async ({ input, context }) => {
    const orgId = context.session.activeOrganizationId;
    if (!orgId) return { requests: [] };

    // Confirma que o usuário é membro da org (qualquer role) — aprovação fica
    // na aplicação; podemos restringir a admins/owners mais à frente se precisar.
    const membership = await prisma.member.findUnique({
      where: { userId_organizationId: { userId: context.user.id, organizationId: orgId } },
      select: { role: true },
    });
    if (!membership) return { requests: [] };

    const station = await prisma.spaceStation.findUnique({
      where: { orgId },
      select: { id: true },
    });
    if (!station) return { requests: [] };

    const requests = await prisma.stationAccessRequest.findMany({
      where: { stationId: station.id, ...(input.status ? { status: input.status } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        message: true,
        status: true,
        createdAt: true,
        decidedAt: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
    return { requests };
  });
