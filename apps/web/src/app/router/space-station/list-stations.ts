import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const listStations = base
  .route({
    method: "GET",
    path: "/public/space-station",
    summary: "List public Space Stations (galaxy explorer)",
  })
  .input(
    z.object({
      search: z.string().optional(),
      type: z.enum(["USER", "ORG"]).optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(50).default(20),
    }),
  )
  .handler(async ({ input }) => {
    const { search, type, page, limit } = input;
    const skip = (page - 1) * limit;

    const where = {
      isPublic: true,
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { nick: { contains: search, mode: "insensitive" as const } },
              { bio: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [stations, total] = await Promise.all([
      prisma.spaceStation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { starsReceived: "desc" },
        select: {
          id: true,
          nick: true,
          type: true,
          bio: true,
          avatarUrl: true,
          rank: true,
          starsReceived: true,
          worldConfig: { select: { planetColor: true, ambientTheme: true } },
          user: { select: { name: true, image: true } },
          org: { select: { name: true, logo: true } },
        },
      }),
      prisma.spaceStation.count({ where }),
    ]);

    return { stations, total, page, limit };
  });
