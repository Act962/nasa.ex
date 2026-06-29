import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteAstroSession = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/astro/sessions/delete",
    summary: "Delete an ASTRO session",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    const session = await prisma.aiSession.findUnique({
      where: { id: input.id },
      select: { userId: true, organizationId: true },
    });
    if (
      !session ||
      session.userId !== context.user.id ||
      session.organizationId !== organizationId
    ) {
      throw errors.NOT_FOUND();
    }

    await prisma.aiSession.delete({ where: { id: input.id } });
    return { ok: true };
  });
