import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { parseStationSettings, roomNamesSchema, templateKeySchema } from "@/features/orbita-station/lib/station-settings";
import prisma from "@/lib/prisma";

/**
 * Troca o modelo e os nomes das salas da estação da empresa (spec 0119, RF-2). Exige "Editar" no app
 * `orbita-station` — conferido pelo `appRouterPermission` do router. Grava só se a versão lida ainda for a atual (CB-2).
 */
export const updateStation = base
  .use(requiredAuthMiddleware)
  .route({ method: "PATCH", path: "/orbita-station", summary: "Atualiza o modelo e os nomes das salas da estação 3D" })
  .input(
    z.object({
      templateKey: templateKeySchema,
      roomNames: roomNamesSchema,
      version: z.number().int().min(0),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.FORBIDDEN({ message: "Escolha uma empresa para editar a estação." });

    const { count } = await prisma.orbitaStation.updateMany({
      where: { organizationId, version: input.version },
      data: { templateKey: input.templateKey, roomNames: input.roomNames, version: { increment: 1 } },
    });
    const station = await prisma.orbitaStation.findUnique({ where: { organizationId } });
    if (!station) throw errors.NOT_FOUND({ message: "A estação desta empresa ainda não foi criada." });
    if (count === 0) {
      throw new ORPCError("CONFLICT", {
        message: "Outra pessoa alterou a estação antes de você. Veja a versão nova e tente de novo.",
        data: { station: parseStationSettings(station) },
      });
    }
    return { station: parseStationSettings(station) };
  });
