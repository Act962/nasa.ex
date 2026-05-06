import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

export const setConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      heartbeatIntervalSeconds: z.union([z.literal(30), z.literal(60)]),
    }),
  )
  .handler(async ({ input, context }) => {
    const member = await prisma.member.findFirst({
      where: { userId: context.user.id, organizationId: context.org.id },
      select: { role: true },
    });

    if (!member || (member.role !== "owner" && member.role !== "moderador")) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas Master e Moderador podem alterar o intervalo de heartbeat.",
      });
    }

    await prisma.organization.update({
      where: { id: context.org.id },
      data: { heartbeatIntervalSeconds: input.heartbeatIntervalSeconds },
    });

    return { heartbeatIntervalSeconds: input.heartbeatIntervalSeconds };
  });
