import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const listAvatarTemplates = base
  .route({
    method: "GET",
    path: "/space-station/avatar-templates",
    summary: "List public avatar (Pipoya spritesheet) templates",
  })
  .input(
    z.object({
      search: z.string().max(100).optional(),
      limit:  z.coerce.number().int().min(1).max(50).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }).optional(),
  )
  .handler(async ({ input }) => {
    // oRPC RPCLink pode serializar {} como undefined — aceitamos ambos
    const { search, limit = 24, offset = 0 } = input ?? {};
    const templates = await prisma.avatarTemplate.findMany({
      where: {
        isPublic: true,
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      select: {
        id:         true,
        name:       true,
        previewUrl: true,
        spriteUrl:  true,
        overlays:   true,
        usedCount:  true,
        createdAt:  true,
        author: { select: { id: true, name: true, image: true } },
      },
      orderBy: { usedCount: "desc" },
      take:  limit,
      skip:  offset,
    });
    return { templates };
  });
