import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

/** Detalhe de uma campanha: cabeçalho + contadores + amostra de destinatários. */
export const get = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const { org } = context;

    const broadcast = await prisma.broadcast.findFirst({
      where: { id: input.id, organizationId: org.id },
      select: {
        id: true,
        name: true,
        status: true,
        trackingId: true,
        templateName: true,
        templateLanguage: true,
        templateCategory: true,
        templateVariables: true,
        scheduledAt: true,
        startedAt: true,
        completedAt: true,
        totalRecipients: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        createdAt: true,
        updatedAt: true,
        tracking: {
          select: {
            id: true,
            name: true,
            whatsappInstance: {
              select: { phoneNumber: true, profileName: true },
            },
          },
        },
      },
    });

    if (!broadcast) {
      throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada" });
    }

    return broadcast;
  });
