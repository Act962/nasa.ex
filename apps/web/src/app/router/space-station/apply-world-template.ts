import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const applyWorldTemplate = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/world-templates/:templateId/apply",
    summary: "Apply a world template to a station's world",
  })
  .input(
    z.object({
      templateId: z.string(),
      stationId:  z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { templateId, stationId } = input;
    const userId  = context.user.id;
    const orgId   = context.session.activeOrganizationId;

    const template = await prisma.worldTemplate.findUnique({ where: { id: templateId } });
    if (!template || !template.isPublic) throw errors.NOT_FOUND({ message: "Template não encontrado" });

    const station = await prisma.spaceStation.findUnique({ where: { id: stationId } });
    if (!station) throw errors.NOT_FOUND({ message: "Station não encontrada" });

    const isOwner =
      (station.type === "USER" && station.userId === userId) ||
      (station.type === "ORG" && (station.orgId === orgId || station.userId === userId));
    if (!isOwner) throw errors.FORBIDDEN({ message: "Sem permissão" });

    const [world] = await Promise.all([
      prisma.spaceStationWorld.upsert({
        where:  { stationId },
        create: { stationId, mapData: template.mapData as never },
        update: { mapData: template.mapData as never },
      }),
      prisma.worldTemplate.update({
        where: { id: templateId },
        data:  { usedCount: { increment: 1 } },
      }),
    ]);

    return { world };
  });
