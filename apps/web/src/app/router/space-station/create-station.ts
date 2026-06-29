import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const createStation = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station",
    summary: "Create a Space Station for user or org",
  })
  .input(
    z.object({
      type: z.enum(["USER", "ORG"]),
      nick: z
        .string()
        .min(2)
        .max(30)
        .regex(/^[a-z0-9_-]+$/, "Nick deve conter apenas letras minúsculas, números, hífens e underscores"),
      bio: z.string().max(300).optional(),
      rank: z.enum(["COMMANDER", "CREW"]).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { type, nick, bio, rank } = input;
    const orgId = context.session.activeOrganizationId;
    const userId = context.user.id;

    const existing = await prisma.spaceStation.findUnique({ where: { nick } });
    if (existing) throw errors.BAD_REQUEST({ message: "Este @nick já está em uso" });

    if (type === "ORG") {
      if (!orgId) throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
      const alreadyExists = await prisma.spaceStation.findUnique({ where: { orgId } });
      if (alreadyExists) throw errors.BAD_REQUEST({ message: "Esta organização já possui uma Space Station" });
    }

    if (type === "USER") {
      const alreadyExists = await prisma.spaceStation.findUnique({ where: { userId } });
      if (alreadyExists) throw errors.BAD_REQUEST({ message: "Este usuário já possui uma Space Station" });
    }

    const station = await prisma.spaceStation.create({
      data: {
        type,
        nick,
        bio,
        rank: rank ?? "CREW",
        userId: type === "USER" ? userId : null,
        orgId: type === "ORG" ? orgId : null,
      },
    });

    return { station };
  });
