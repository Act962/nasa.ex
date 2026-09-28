import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const requestSeiProcessSync = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ linkId: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    const link = await prisma.seiProcessLink.findFirst({
      where: { id: input.linkId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!link) throw errors.NOT_FOUND({ message: "Vínculo SEI não encontrado." });
    const integration = await prisma.platformIntegration.findUnique({
      where: {
        organizationId_platform: {
          organizationId: context.org.id,
          platform: "SEI",
        },
      },
      select: { isActive: true },
    });
    if (!integration?.isActive) {
      throw errors.BAD_REQUEST({
        message: "Ative a integração SEI em Integrações antes de sincronizar.",
      });
    }
    await inngest.send({
      name: "sei/sync-process",
      data: { linkId: link.id, organizationId: context.org.id },
    });
    return { queued: true };
  });
