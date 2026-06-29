import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

/**
 * Linnker pages públicas da empresa (feature já existente).
 */
export const listLinnker = base
  .use(spaceVisibilityGuard)
  .input(z.object({ nick: z.string().min(1) }))
  .handler(async ({ context }) => {
    const pages = await prisma.linnkerPage.findMany({
      where: {
        organizationId: context.organization.id,
        isPublished: true,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        bio: true,
        avatarUrl: true,
        coverColor: true,
        links: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
            url: true,
            icon: true,
            emoji: true,
            position: true,
          },
        },
      },
    });
    return { pages };
  });
