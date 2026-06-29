import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * Remove um nó do organograma. Se tiver filhos, eles são promovidos
 * para o parent do nó removido (evita "órfãos") antes do delete.
 */
export const deleteRole = base
  .use(orgAdminGuard)
  .input(
    z.object({
      orgId: z.string().min(1),
      roleId: z.string().min(1),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const role = await prisma.orgRole.findFirst({
      where: { id: input.roleId, orgId: context.orgId },
      select: { id: true, parentId: true },
    });
    if (!role) throw errors.NOT_FOUND({ message: "Cargo não encontrado." });

    await prisma.$transaction([
      // promove filhos para o parent deste role
      prisma.orgRole.updateMany({
        where: { parentId: role.id, orgId: context.orgId },
        data: { parentId: role.parentId },
      }),
      prisma.orgRole.delete({ where: { id: role.id } }),
    ]);

    await prisma.spacehomeAuditLog
      .create({
        data: {
          orgId: context.orgId,
          actorId: context.user.id,
          action: "role_deleted",
          target: role.id,
        },
      })
      .catch(() => null);

    return { ok: true };
  });
