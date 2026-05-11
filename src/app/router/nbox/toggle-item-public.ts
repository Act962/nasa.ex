import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { randomBytes } from "crypto";

/**
 * Alterna a flag `isPublic` de um item do N-Box.
 *
 * Quando o usuário liga "Visualização Pública":
 *  - É EXIGIDO `consent: true` no input (front mostra dialog "Atenção…
 *    qualquer usuário pode acessar e baixar o arquivo").
 *  - Geramos um `publicToken` único pra URL pública `/api/nbox/public/<token>`.
 *  - Registramos em `logActivity` (vai pra "Atividades no admin" + insights).
 *
 * Quando desliga: limpamos o token e revogamos os links publicados.
 */
export const toggleItemPublic = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      itemId:  z.string().min(1),
      isPublic: z.boolean(),
      /** Consentimento explícito (obrigatório quando isPublic=true). */
      consent: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.nBoxItem.findFirst({
      where: { id: input.itemId, organizationId: context.org.id },
      select: { id: true, name: true, isPublic: true, publicToken: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Arquivo não encontrado." });
    }

    if (input.isPublic && !input.consent) {
      throw errors.BAD_REQUEST({
        message:
          "Consentimento obrigatório pra tornar o arquivo público. Confirme o aviso de visualização pública.",
      });
    }

    const item = await prisma.nBoxItem.update({
      where: { id: existing.id },
      data: {
        isPublic: input.isPublic,
        publicToken: input.isPublic
          ? existing.publicToken ?? randomBytes(16).toString("base64url")
          : null,
      },
      select: { id: true, name: true, isPublic: true, publicToken: true },
    });

    // ── Auditoria (admin + insights) ──────────────────────────────
    await logActivity({
      organizationId: context.org.id,
      userId:    context.user.id,
      userName:  context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as { image?: string | null }).image ?? null,
      appSlug:   "nbox",
      action:    input.isPublic ? "nbox.item.made_public" : "nbox.item.made_private",
      actionLabel: input.isPublic
        ? `Tornou o arquivo "${item.name}" público — qualquer pessoa com o link pode acessar e baixar.`
        : `Tornou o arquivo "${item.name}" privado — link público revogado.`,
      resource:   item.name,
      resourceId: item.id,
      metadata: {
        isPublic:     item.isPublic,
        consentGiven: input.consent === true,
      },
    });

    return { item };
  });
