import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";

/**
 * Usuário responde ao pedido de consent (§7.1).
 * - `accept=true` ⇒ publicConsent=true e consentedAt=now.
 * - `accept=false` ⇒ remove o vínculo (role.userId=null) para não vazar dados.
 *
 * Este NÃO passa pelo `orgAdminGuard` — é o usuário-alvo respondendo
 * sobre ele mesmo.
 */
export const respondRoleConsent = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      roleId: z.string().min(1),
      accept: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const role = await prisma.orgRole.findUnique({
      where: { id: input.roleId },
      select: { id: true, userId: true, orgId: true, publicConsent: true },
    });
    if (!role) throw errors.NOT_FOUND({ message: "Cargo não encontrado." });
    if (role.userId !== context.user.id) {
      throw errors.FORBIDDEN({
        message: "Este pedido de consent não é seu.",
      });
    }

    if (input.accept) {
      const updated = await prisma.orgRole.update({
        where: { id: role.id },
        data: { publicConsent: true, consentedAt: new Date() },
      });
      await prisma.spacehomeAuditLog
        .create({
          data: {
            orgId: role.orgId,
            actorId: context.user.id,
            action: "role_consented",
            target: role.id,
          },
        })
        .catch(() => null);
      return { ok: true, accepted: true, role: updated };
    }

    // Recusa ⇒ desvincula usuário (vira vaga aberta ou some conforme admin)
    const updated = await prisma.orgRole.update({
      where: { id: role.id },
      data: { userId: null, publicConsent: true, consentedAt: null },
    });
    await prisma.spacehomeAuditLog
      .create({
        data: {
          orgId: role.orgId,
          actorId: context.user.id,
          action: "role_declined",
          target: role.id,
        },
      })
      .catch(() => null);
    return { ok: true, accepted: false, role: updated };
  });
