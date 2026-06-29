import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getOrgChart = base
  .route({
    method: "GET",
    path: "/public/space-station/:nick/org-chart",
    summary: "Get org chart (commanders & crew) for a station",
  })
  .input(z.object({ nick: z.string() }))
  .handler(async ({ input, errors }) => {
    const station = await prisma.spaceStation.findUnique({
      where: { nick: input.nick, isPublic: true, type: "ORG" },
      select: { orgId: true },
    });

    if (!station?.orgId) throw errors.NOT_FOUND({ message: "Space Station não encontrada" });

    const members = await prisma.member.findMany({
      where: { organizationId: station.orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            nickname: true,
            spaceStation: {
              select: { nick: true, rank: true, avatarUrl: true, isPublic: true },
            },
          },
        },
      },
    });

    const commanders = members.filter(
      (m) => m.role === "owner" || m.user.spaceStation?.rank === "COMMANDER",
    );
    const crew = members.filter(
      (m) => m.role !== "owner" && m.user.spaceStation?.rank !== "COMMANDER",
    );

    return { commanders, crew };
  });
