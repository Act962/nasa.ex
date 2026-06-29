import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import z from "zod";

export const updatePublicModules = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    path: "/space-station/:stationId/modules",
    summary: "Configure which modules are public on a Space Station",
  })
  .input(
    z.object({
      stationId: z.string(),
      modules: z.array(
        z.object({
          module: z.enum(["FORM", "CHAT", "AGENDA", "INTEGRATION", "NBOX", "FORGE", "APPS", "NOTIFICATIONS"]),
          resourceId: z.string().optional(),
          isActive: z.boolean(),
          config: z.record(z.string(), z.unknown()).optional(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { stationId, modules } = input;
    const orgId = context.session.activeOrganizationId;
    const userId = context.user.id;

    const station = await prisma.spaceStation.findUnique({ where: { id: stationId } });
    if (!station) throw errors.NOT_FOUND({ message: "Space Station não encontrada" });

    const isOwner =
      (station.type === "USER" && station.userId === userId) ||
      (station.type === "ORG" && station.orgId === orgId);

    if (!isOwner) throw errors.FORBIDDEN({ message: "Sem permissão" });

    await prisma.$transaction(
      modules.map((m) => {
        const config =
          m.config !== undefined ? (m.config as Prisma.InputJsonValue) : undefined;
        return prisma.stationPublicModule.upsert({
          where: { stationId_module: { stationId, module: m.module } },
          create: {
            stationId,
            module: m.module,
            isActive: m.isActive,
            resourceId: m.resourceId,
            ...(config !== undefined ? { config } : {}),
          },
          update: {
            isActive: m.isActive,
            resourceId: m.resourceId,
            ...(config !== undefined ? { config } : {}),
          },
        });
      }),
    );

    const updated = await prisma.stationPublicModule.findMany({ where: { stationId } });
    return { modules: updated };
  });
