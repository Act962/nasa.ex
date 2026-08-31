import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { createMessageTemplate } from "@/http/whats-oficial";
import { createTemplateSchema } from "@/features/campanhas/schema/template-schemas";
import { resolveCampaignMetaCredentials } from "@/features/campanhas/server/lib/broadcast-access";
import {
  buildCreateTemplateRequest,
  validateTemplateInput,
} from "@/features/campanhas/lib/build-template-components";

/**
 * Cria um template de **marketing** ou **utilidade** na WABA do número de origem
 * e o envia pra análise da Meta (fica `PENDING` até aprovação). Só
 * monta/valida/persiste na Meta — não dispara nada. O disparo em massa entra na
 * Fase 3.
 */
const CATEGORY_LABEL: Record<"MARKETING" | "UTILITY", string> = {
  MARKETING: "marketing",
  UTILITY: "utilidade",
};

export const createTemplate = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(createTemplateSchema)
  .handler(async ({ input, context, errors }) => {
    const { org, user } = context;
    const { trackingId, ...template } = input;

    const validationErrors = validateTemplateInput(template);
    if (validationErrors.length > 0) {
      throw errors.BAD_REQUEST({
        message: validationErrors.join(" "),
        data: { code: "TEMPLATE_VALIDATION_FAILED" } as never,
      });
    }

    const credentials = await resolveCampaignMetaCredentials(trackingId, org.id);

    const created = await createMessageTemplate(
      credentials.accessToken,
      credentials.wabaId,
      buildCreateTemplateRequest(template),
    );

    await logActivity({
      organizationId: org.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      appSlug: "campanhas",
      action: "broadcast_template.created",
      actionLabel: `Criou um modelo de ${CATEGORY_LABEL[template.category]} (${template.name})`,
      resource: "broadcast_template",
      resourceId: created.id,
      metadata: {
        name: template.name,
        language: template.language,
        status: created.status,
      },
    }).catch(() => {});

    return {
      id: created.id,
      name: template.name,
      language: template.language,
      status: created.status,
      category: created.category,
    };
  });
