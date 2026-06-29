import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Aprovação explícita do dono para exibir o formulário na Spacehome pública.
 * Independente de `published` (que controla apenas se o form aceita respostas).
 *
 * - Quando liga `isPublicOnSpace=true`: EXIGE `consent: true` (front mostra
 *   o `<PublicVisibilityDialog>` antes de chamar) e registra em
 *   `logActivity` ("Atividades no admin" + insights).
 * - Quando desliga: limpa silenciosamente, mas ainda registra a ação no log.
 */
export const togglePublicOnSpace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PATCH",
    path: "/forms/:id/public-on-space",
    summary: "Toggle Spacehome visibility for a form",
  })
  .input(
    z.object({
      id:              z.string(),
      isPublicOnSpace: z.boolean(),
      /** Consentimento explícito (obrigatório quando ligando). */
      consent:         z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // Garante que o form pertence à org do usuário
    const existing = await prisma.form.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, name: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Formulário não encontrado." });
    }

    if (input.isPublicOnSpace && !input.consent) {
      throw errors.BAD_REQUEST({
        message:
          "Consentimento obrigatório pra tornar o formulário público. Confirme o aviso de visualização pública.",
      });
    }

    const form = await prisma.form.update({
      where: { id: input.id },
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
      appSlug:   "form",
      action:    input.isPublicOnSpace ? "form.made_public" : "form.made_private",
      actionLabel: input.isPublicOnSpace
        ? `Tornou o formulário "${form.name}" público — qualquer pessoa com o link da Spacehome pode responder.`
        : `Tornou o formulário "${form.name}" privado — removido da Spacehome pública.`,
      resource:   form.name,
      resourceId: form.id,
      metadata: {
        isPublicOnSpace: form.isPublicOnSpace,
        consentGiven:    input.consent === true,
      },
    });

    return {
      message: form.isPublicOnSpace
        ? "Formulário agora aparece na Spacehome pública."
        : "Formulário removido da Spacehome pública.",
      isPublicOnSpace: form.isPublicOnSpace,
    };
  });
