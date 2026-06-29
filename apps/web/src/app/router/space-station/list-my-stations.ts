import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";

export const listMyStations = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/space-station/my/all",
    summary: "List all Space Stations belonging to the current user or their orgs",
  })
  .handler(async ({ context }) => {
    const userId = context.user.id;

    // Busca as orgs do usuário
    const memberships = await prisma.member.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);

    const stations = await prisma.spaceStation.findMany({
      where: {
        OR: [
          { userId },
          ...(orgIds.length ? [{ orgId: { in: orgIds } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nick: true,
        type: true,
        bio: true,
        avatarUrl: true,
        isPublic: true,
        rank: true,
        starsReceived: true,
        createdAt: true,
        worldConfig: { select: { planetColor: true, ambientTheme: true } },
        user: { select: { name: true, image: true } },
        org: { select: { name: true, logo: true } },
      },
    });

    return { stations };
  });
