import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { listRecipientsSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";

/** Lista paginada (cursor por id) dos destinatários de uma campanha. */
export const listRecipients = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(listRecipientsSchema)
  .handler(async ({ input, context }) => {
    const { org } = context;
    await loadBroadcastForOrg(input.broadcastId, org.id);

    const recipients = await prisma.broadcastRecipient.findMany({
      where: {
        broadcastId: input.broadcastId,
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor
        ? { cursor: { id: input.cursor }, skip: 1 }
        : {}),
      select: {
        id: true,
        leadId: true,
        name: true,
        phone: true,
        status: true,
        errorMessage: true,
        sentAt: true,
        deliveredAt: true,
        readAt: true,
        createdAt: true,
      },
    });

    let nextCursor: string | undefined;
    if (recipients.length > input.limit) {
      const extra = recipients.pop();
      nextCursor = extra?.id;
    }

    return { recipients, nextCursor };
  });
