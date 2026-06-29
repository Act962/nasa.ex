import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Alterna a flag `isPublicOnSpace` de um Project (Workspace compartilhado).
 *
 * - Quando ligando `isPublicOnSpace=true`: EXIGE `consent: true` (front
 *   mostra `<PublicVisibilityDialog>` antes de chamar) e registra em
 *   `logActivity` ("Atividades no admin" + insights).
 * - Quando desligando: limpa silenciosamente, ainda registra a ação no log.
 */
export const togglePublic = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      projectId:        z.string().min(1),
      isPublicOnSpace:  z.boolean(),
      /** Consentimento explícito (obrigatório quando ligando). */
      consent:          z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.orgProject.findFirst({
      where: { id: input.projectId, organizationId: context.org.id },
      select: { id: true, name: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Projeto não encontrado." });
    }

    if (input.isPublicOnSpace && !input.consent) {
      throw errors.BAD_REQUEST({
        message:
          "Consentimento obrigatório pra tornar o projeto público. Confirme o aviso de visualização pública.",
      });
    }

    const project = await prisma.orgProject.update({
      where: { id: existing.id },
      data:  { isPublicOnSpace: input.isPublicOnSpace },
      select: { id: true, name: true, isPublicOnSpace: true },
    });

    // ── Auditoria (admin + insights) ──────────────────────────────
    await logActivity({
      organizationId: context.org.id,
      userId:    context.user.id,
      userName:  context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as { image?: string | null }).image ?? null,
      appSlug:   "workspaces",
      action:    input.isPublicOnSpace
        ? "org-project.made_public"
        : "org-project.made_private",
      actionLabel: input.isPublicOnSpace
        ? `Tornou o projeto "${project.name}" público — aparece na Spacehome da empresa pra qualquer pessoa.`
        : `Tornou o projeto "${project.name}" privado — removido da Spacehome pública.`,
      resource:   project.name,
      resourceId: project.id,
      metadata: {
        isPublicOnSpace: project.isPublicOnSpace,
        consentGiven:    input.consent === true,
      },
    });

    return { project };
  });
