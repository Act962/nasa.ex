import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import z from "zod";

export const sendStar = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/send-star",
    summary: "Send STARs to another Space Station",
  })
  .input(
    z.object({
      fromNick: z.string(),
      toNick: z.string(),
      amount: z.number().int().min(1).max(100),
      message: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { fromNick, toNick, amount, message } = input;
    const orgId = context.session.activeOrganizationId;
    const userId = context.user.id;

    if (fromNick === toNick) throw errors.BAD_REQUEST({ message: "Não é possível enviar STARs para si mesmo" });

    const [from, to] = await Promise.all([
      prisma.spaceStation.findUnique({ where: { nick: fromNick } }),
      prisma.spaceStation.findUnique({ where: { nick: toNick, isPublic: true } }),
    ]);

    if (!from) throw errors.NOT_FOUND({ message: "Station de origem não encontrada" });
    if (!to) throw errors.NOT_FOUND({ message: "Station de destino não encontrada" });

    const isOwner =
      (from.type === "USER" && from.userId === userId) ||
      (from.type === "ORG" && from.orgId === orgId);

    if (!isOwner) throw errors.FORBIDDEN({ message: "Sem permissão para enviar STARs desta station" });

    const [star] = await prisma.$transaction([
      prisma.spaceStationStar.create({
        data: { fromId: from.id, toId: to.id, amount, message },
      }),
      prisma.spaceStation.update({
        where: { id: to.id },
        data: { starsReceived: { increment: amount } },
      }),
    ]);

    if (orgId) {
      await logActivity({
        organizationId: orgId,
        userId,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "space-station",
        subAppSlug: "station-stars",
        featureKey: "station.star.sent",
        action: "station.star.sent",
        actionLabel: `Enviou ${amount} ★ de "@${fromNick}" para "@${toNick}"`,
        resource: toNick,
        resourceId: star.id,
        metadata: { fromNick, toNick, amount, hasMessage: !!message },
      });
    }

    return { star };
  });
