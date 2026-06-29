import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const updateStationAccessMode = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/access-mode",
    summary: "Update the active organization station access mode",
  })
  .input(z.object({ accessMode: z.enum(["OPEN", "MEMBERS_ONLY", "REQUEST"]) }))
  .handler(async ({ input, context }) => {
    const orgId = context.session.activeOrganizationId;
    if (!orgId) throw new Error("Organização ativa não definida");

    const member = await prisma.member.findUnique({
      where: { userId_organizationId: { userId: context.user.id, organizationId: orgId } },
      select: { role: true },
    });
    if (!member) throw new Error("Sem permissão");

    const station = await prisma.spaceStation.update({
      where: { orgId },
      data: { accessMode: input.accessMode },
      select: { accessMode: true },
    });
    return station;
  });
