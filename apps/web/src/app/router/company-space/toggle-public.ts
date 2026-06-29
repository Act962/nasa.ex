import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * Liga/desliga a visibilidade pública da Spacehome (§7.1).
 * Também loga em SpacehomeAuditLog.
 */
export const togglePublic = base
  .use(orgAdminGuard)
  .input(
    z.object({
      orgId: z.string().min(1),
      isSpacehomePublic: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    const org = await prisma.organization.update({
      where: { id: context.orgId },
      data: { isSpacehomePublic: input.isSpacehomePublic },
      select: { id: true, isSpacehomePublic: true },
    });

    await prisma.spacehomeAuditLog
      .create({
        data: {
          orgId: context.orgId,
          actorId: context.user.id,
          action: "space_toggled_public",
          target: org.id,
          metadata: { isSpacehomePublic: input.isSpacehomePublic },
        },
      })
      .catch(() => null);

    return org;
  });
