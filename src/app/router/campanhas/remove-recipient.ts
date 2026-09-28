import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { removeRecipientSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";

/** Remove um destinatário da campanha e reajusta `totalRecipients`. */
export const removeRecipient = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(removeRecipientSchema)
  .handler(async ({ input, context }) => {
    const { org } = context;
    await loadBroadcastForOrg(input.broadcastId, org.id);

    await prisma.broadcastRecipient.deleteMany({
      where: { id: input.recipientId, broadcastId: input.broadcastId },
    });

    const totalRecipients = await prisma.broadcastRecipient.count({
      where: { broadcastId: input.broadcastId },
    });
    await prisma.broadcast.update({
      where: { id: input.broadcastId },
      data: { totalRecipients },
    });

    return { removed: input.recipientId, totalRecipients };
  });
