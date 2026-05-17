import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { userIsOrgAdmin } from "@/features/astro/server/tools/_shared/permissions";

/**
 * Apaga uma AlertRule (default: soft delete via isActive=false).
 *
 * Passe `hard: true` pra remover de verdade (perde audit de AlertDispatch
 * relacionados; só admin/owner pode fazer hard delete).
 *
 * Permissão padrão (soft): criador ou admin/owner.
 */
export const deleteAlertRule = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/alerts/delete-rule",
    summary: "Apaga (ou desativa) uma regra de alerta",
  })
  .input(
    z.object({
      id: z.string(),
      hard: z.boolean().optional(),
    }),
  )
  .output(
    z.object({
      ok: z.boolean(),
      mode: z.enum(["soft", "hard"]),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    const existing = await prisma.alertRule.findUnique({
      where: { id: input.id },
      select: { id: true, organizationId: true, createdBy: true },
    });
    if (
      !existing ||
      (existing.organizationId !== null &&
        existing.organizationId !== organizationId)
    ) {
      throw errors.NOT_FOUND();
    }

    const isCreator = existing.createdBy === context.user.id;
    const isAdmin = await userIsOrgAdmin(context.user.id, organizationId);

    if (input.hard) {
      // Hard delete só pra admin/owner — soft delete preserva auditoria.
      if (!isAdmin) {
        throw errors.FORBIDDEN({
          message: "Só admin/owner pode apagar definitivamente.",
        });
      }
      await prisma.alertRule.delete({ where: { id: input.id } });
      return { ok: true, mode: "hard" as const };
    }

    if (!isCreator && !isAdmin) {
      throw errors.FORBIDDEN({
        message: "Só o criador ou admin/owner pode desativar.",
      });
    }
    await prisma.alertRule.update({
      where: { id: input.id },
      data: { isActive: false },
    });
    return { ok: true, mode: "soft" as const };
  });
