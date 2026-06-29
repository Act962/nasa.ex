import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getWorld = base
  .route({
    method: "GET",
    path: "/public/space-station/:nick/world",
    summary: "Get world config for a Space Station (for Phaser)",
  })
  .input(z.object({ nick: z.string() }))
  .handler(async ({ input, errors }) => {
    const station = await prisma.spaceStation.findUnique({
      where: { nick: input.nick, isPublic: true },
      select: {
        id: true,
        nick: true,
        worldConfig: true,
        org: { select: { name: true, logo: true } },
        user: { select: { name: true, image: true } },
      },
    });

    if (!station) throw errors.NOT_FOUND({ message: "Space Station não encontrada" });

    return { station };
  });
