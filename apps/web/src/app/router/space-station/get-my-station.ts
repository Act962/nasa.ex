import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getMyStation = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/space-station/my",
    summary: "Get the current user or org Space Station",
  })
  .input(z.object({ type: z.enum(["USER", "ORG"]) }))
  .handler(async ({ input, context }) => {
    const orgId = context.session.activeOrganizationId;
    const userId = context.user.id;

    // Busca pela org primeiro, depois pelo usuário como fallback
    const station = await prisma.spaceStation.findFirst({
      where: {
        OR: [
          ...(orgId ? [{ orgId }] : []),
          { userId },
        ],
      },
      include: {
        worldConfig: true,
        publicModules: true,
      },
    });

    return { station };
  });
