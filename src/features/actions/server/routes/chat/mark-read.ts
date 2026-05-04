import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";
import { assertActionAccess } from "./_helpers";

export const markReadActionChat = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/action/chat/mark-read",
    summary: "Mark action chat as read",
  })
  .input(z.object({ actionId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const { hasAccess } = await assertActionAccess(
      input.actionId,
      context.user.id,
      context.org,
    );
    if (!hasAccess) throw errors.FORBIDDEN({ message: "Sem acesso ao chat" });

    await prisma.actionChatRead.upsert({
      where: {
        actionId_userId: {
          actionId: input.actionId,
          userId: context.user.id,
        },
      },
      update: { lastReadAt: new Date() },
      create: {
        actionId: input.actionId,
        userId: context.user.id,
        lastReadAt: new Date(),
      },
    });

    return { success: true };
  });
