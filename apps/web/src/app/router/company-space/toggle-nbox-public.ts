import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * Liga/desliga `NBoxItem.isPublic`. Quando ligar, gera `publicToken`
 * (se não existir) para uso no endpoint /api/nbox/public/[token].
 * Quando desligar, mantém o token (invalidação é via isPublic=false
 * no endpoint público — assim reabrir não gera token novo).
 */
export const toggleNBoxPublic = base
  .use(orgAdminGuard)
  .input(
    z.object({
      orgId: z.string().min(1),
      itemId: z.string().min(1),
      isPublic: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const item = await prisma.nBoxItem.findFirst({
      where: { id: input.itemId, organizationId: context.orgId },
      select: { id: true, publicToken: true },
    });
    if (!item) throw errors.NOT_FOUND({ message: "Arquivo não encontrado." });

    const token =
      input.isPublic && !item.publicToken
        ? randomUUID().replace(/-/g, "")
        : item.publicToken;

    const updated = await prisma.nBoxItem.update({
      where: { id: item.id },
      data: {
        isPublic: input.isPublic,
        publicToken: token,
      },
      select: { id: true, isPublic: true, publicToken: true },
    });

    await prisma.spacehomeAuditLog
      .create({
        data: {
          orgId: context.orgId,
          actorId: context.user.id,
          action: "nbox_toggled_public",
          target: item.id,
          metadata: { isPublic: input.isPublic },
        },
      })
      .catch(() => null);

    return updated;
  });
