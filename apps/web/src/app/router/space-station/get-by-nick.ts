import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getStationByNick = base
  .route({
    method: "GET",
    path: "/public/space-station/:nick",
    summary: "Get a public Space Station by nick",
  })
  .input(z.object({ nick: z.string() }))
  .handler(async ({ input, errors }) => {
    const station = await prisma.spaceStation.findUnique({
      where: { nick: input.nick, isPublic: true },
      include: {
        user: {
          select: { id: true, name: true, image: true, nickname: true },
        },
        org: {
          select: { id: true, name: true, slug: true, logo: true },
        },
        worldConfig: true,
        publicModules: { where: { isActive: true } },
        receivedStars: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, amount: true, message: true, createdAt: true },
        },
      },
    });

    if (!station) throw errors.NOT_FOUND({ message: "Space Station não encontrada" });

    return { station };
  });
