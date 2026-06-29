import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

export const getInviteLinkByToken = base
  .input(z.object({ token: z.string().min(1) }))
  .handler(async ({ input }) => {
    const link = await prisma.organizationInviteLink.findUnique({
      where: { token: input.token },
      include: {
        organization: { select: { id: true, name: true, slug: true, logo: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!link) {
      throw new ORPCError("NOT_FOUND", { message: "Link de convite inválido" });
    }
    if (link.revokedAt) {
      throw new ORPCError("FORBIDDEN", { message: "Este link foi revogado" });
    }
    if (link.expiresAt.getTime() < Date.now()) {
      throw new ORPCError("FORBIDDEN", { message: "Este link expirou" });
    }

    return {
      id: link.id,
      role: link.role,
      expiresAt: link.expiresAt,
      organization: link.organization,
      createdBy: link.createdBy,
    };
  });
