import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import z from "zod";

export const updateStation = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/space-station/:id",
    summary: "Update a Space Station",
  })
  .input(
    z.object({
      id: z.string(),
      bio: z.string().max(300).optional(),
      avatarUrl: z.string().url().optional().nullable(),
      bannerUrl: z.string().url().optional().nullable(),
      theme: z.record(z.string(), z.unknown()).optional(),
      rank: z.enum(["COMMANDER", "CREW"]).optional(),
      isPublic: z.boolean().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, theme, config, ...rest } = input;
    const orgId = context.session.activeOrganizationId;
    const userId = context.user.id;

    const station = await prisma.spaceStation.findUnique({ where: { id } });
    if (!station) throw errors.NOT_FOUND({ message: "Space Station não encontrada" });

    const isOwner =
      (station.type === "USER" && station.userId === userId) ||
      (station.type === "ORG" && station.orgId === orgId);

    if (!isOwner) throw errors.FORBIDDEN({ message: "Sem permissão para editar esta station" });

    const data: Prisma.SpaceStationUpdateInput = {
      ...rest,
      ...(theme !== undefined ? { theme: theme as Prisma.InputJsonValue } : {}),
      ...(config !== undefined ? { config: config as Prisma.InputJsonValue } : {}),
    };

    const updated = await prisma.spaceStation.update({
      where: { id },
      data,
    });

    return { station: updated };
  });
