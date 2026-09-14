import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { getPublicMediaUrl } from "@/lib/r2-url";

/** Thread de suporte do pedido, na visão do cliente. */
export const listTrafegoMessages = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await assertOwnedOrder(input.orderId, context.org.id);

    const messages = await prisma.trafegoSupportMessage.findMany({
      where: { orderId: input.orderId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        body: true,
        authorRole: true,
        attachmentKey: true,
        createdAt: true,
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return Promise.all(
      messages.map(async (message) => ({
        ...message,
        attachmentUrl: message.attachmentKey
          ? await getPublicMediaUrl(message.attachmentKey)
          : null,
      })),
    );
  });

export const sendTrafegoMessage = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      body: z.string().trim().min(1, "Escreva sua mensagem").max(4000),
      attachmentKey: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await assertOwnedOrder(input.orderId, context.org.id);

    const message = await prisma.trafegoSupportMessage.create({
      data: {
        orderId: input.orderId,
        authorUserId: context.user.id,
        authorRole: "CLIENT",
        body: input.body,
        attachmentKey: input.attachmentKey,
        readByClientAt: new Date(),
      },
      select: { id: true, createdAt: true },
    });

    return message;
  });

export const markTrafegoMessagesRead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await assertOwnedOrder(input.orderId, context.org.id);

    await prisma.trafegoSupportMessage.updateMany({
      where: {
        orderId: input.orderId,
        authorRole: "NASA",
        readByClientAt: null,
      },
      data: { readByClientAt: new Date() },
    });

    return { success: true };
  });

async function assertOwnedOrder(orderId: string, organizationId: string) {
  const order = await prisma.trafegoOrder.findFirst({
    where: { id: orderId, organizationId },
    select: { id: true },
  });
  if (!order) {
    throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada." });
  }
  return order;
}
