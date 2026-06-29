import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { PUBLIC_USER_SELECT } from "@/features/space-page/utils/public-selectors";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

/**
 * Top membros de uma empresa por SpacePoints. Usado no `card-ranking`.
 *
 * Só retorna os campos públicos do usuário (id, name, image) — nunca
 * email, phone etc. (ver public-selectors.ts).
 */
export const listRanking = base
  .use(spaceVisibilityGuard)
  .input(
    z.object({
      nick: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(10),
    }),
  )
  .handler(async ({ input, context }) => {
    const { organization } = context;

    const rows = await prisma.userSpacePoint.findMany({
      where: { orgId: organization.id },
      orderBy: { totalPoints: "desc" },
      take: input.limit,
      select: {
        totalPoints: true,
        weeklyPoints: true,
        user: { select: PUBLIC_USER_SELECT },
      },
    });

    return rows.map((r, idx) => ({
      position: idx + 1,
      totalPoints: r.totalPoints,
      weeklyPoints: r.weeklyPoints,
      user: r.user,
    }));
  });
