import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { WhatsAppTemplateCategory } from "@/generated/prisma/enums";
import { setBroadcastTemplateSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";

/**
 * Anexa um template aprovado (nome, idioma, categoria) + o mapa de variáveis a
 * uma campanha ainda em rascunho. A categoria define o endpoint de envio na
 * Fase 3. Só edita broadcast `DRAFT` — depois de disparado é imutável.
 */
export const setTemplate = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(setBroadcastTemplateSchema)
  .handler(async ({ input, context, errors }) => {
    const { org } = context;
    const broadcast = await loadBroadcastForOrg(input.broadcastId, org.id);

    if (broadcast.status !== "DRAFT") {
      throw errors.BAD_REQUEST({
        message: "Só é possível trocar o template de uma campanha em rascunho.",
      });
    }

    const updated = await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: {
        templateName: input.templateName,
        templateLanguage: input.templateLanguage,
        templateCategory: input.templateCategory as WhatsAppTemplateCategory,
        templateVariables: input.mapping,
      },
      select: {
        id: true,
        templateName: true,
        templateLanguage: true,
        templateCategory: true,
        updatedAt: true,
      },
    });

    return updated;
  });
