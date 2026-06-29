import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * Dispara (ou redispara) notificação interna para o usuário vinculado
 * ao OrgRole, pedindo consent explícito para aparecer no organograma
 * público (§7.1 do plano).
 *
 * - Se `publicConsent` já for `true`, não faz nada (evita ruído).
 * - Se `userId` for null (vaga aberta), retorna erro.
 */
export const notifyRoleConsent = base
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
      select: {
        id: true,
        userId: true,
        publicConsent: true,
        jobTitle: { select: { title: true } },
        org: { select: { id: true, name: true } },
      },
    });

    if (!role) {
      throw errors.NOT_FOUND({ message: "Cargo não encontrado." });
    }
    if (!role.userId) {
      throw errors.BAD_REQUEST({
        message: "Este cargo é uma vaga aberta, não há usuário para notificar.",
      });
    }
    if (role.publicConsent) {
      return { ok: true, alreadyConsented: true };
    }

    await prisma.userNotification.create({
      data: {
        userId: role.userId,
        organizationId: role.org.id,
        type: "CARD_EDIT",
        title: `${role.org.name} te adicionou ao organograma`,
        body: `Você foi adicionado como "${role.jobTitle.title}" no organograma público. Aceita aparecer?`,
        appKey: "space-page",
        actionUrl: `/profile/role-consent/${role.id}`,
        metadata: {
          kind: "space_role_consent",
          roleId: role.id,
          orgId: role.org.id,
        },
      },
    });

    await prisma.spacehomeAuditLog
      .create({
        data: {
          orgId: context.orgId,
          actorId: context.user.id,
          action: "role_consent_requested",
          target: role.id,
          metadata: { userId: role.userId },
        },
      })
      .catch(() => null);

    return { ok: true, alreadyConsented: false };
  });
