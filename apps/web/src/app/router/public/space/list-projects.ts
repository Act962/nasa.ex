import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

export const listProjects = base
  .use(spaceVisibilityGuard)
  .input(
    z.object({
      nick: z.string().min(1),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(30).default(10),
    }),
  )
  .handler(async ({ input, context }) => {
    const projects = await prisma.orgProject.findMany({
      where: {
        organizationId: context.organization.id,
        isActive: true,
        isPublicOnSpace: true,   // só projetos aprovados pelo dono p/ exibição pública
      },
      orderBy: { createdAt: "desc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        avatar: true,
        color: true,
        website: true,
        slogan: true,
        createdAt: true,
      },
    });

    let nextCursor: string | null = null;
    if (projects.length > input.limit) {
      const next = projects.pop();
      nextCursor = next?.id ?? null;
    }

    return { projects, nextCursor };
  });
