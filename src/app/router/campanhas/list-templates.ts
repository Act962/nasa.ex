import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { getMessageTemplates } from "@/http/whats-oficial";
import type { MessageTemplate } from "@/http/whats-oficial";
import { listTemplatesSchema } from "@/features/campanhas/schema/template-schemas";
import { resolveCampaignMetaCredentials } from "@/features/campanhas/server/lib/broadcast-access";

/**
 * Lista os templates de **marketing** e **utilidade** da WABA do número de
 * origem — todos os status (o recém-criado aparece como `PENDING`). Alimenta a
 * tela de Modelos do app de Campanhas.
 */

export interface CampaignTemplateSummary {
  id: string;
  name: string;
  language: string;
  status: MessageTemplate["status"];
  category: MessageTemplate["category"];
  bodyText: string;
  headerFormat: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  footerText: string | null;
  buttonLabels: string[];
  variableCount: number;
}

function countPlaceholders(text: string | undefined): number {
  if (!text) return 0;
  const matches = text.match(/\{\{\s*\d+\s*\}\}/g);
  return matches ? new Set(matches).size : 0;
}

function summarize(template: MessageTemplate): CampaignTemplateSummary {
  const body = template.components.find((component) => component.type === "BODY");
  const header = template.components.find(
    (component) => component.type === "HEADER",
  );
  const footer = template.components.find(
    (component) => component.type === "FOOTER",
  );
  const buttons = template.components.find(
    (component) => component.type === "BUTTONS",
  );

  const headerFormat = (header?.format ??
    (header ? "TEXT" : "NONE")) as CampaignTemplateSummary["headerFormat"];

  return {
    id: template.id,
    name: template.name,
    language: template.language,
    status: template.status,
    category: template.category,
    bodyText: body?.text ?? "",
    headerFormat,
    footerText: footer?.text ?? null,
    buttonLabels: (buttons?.buttons ?? [])
      .map((button) => button.text)
      .filter((text): text is string => Boolean(text)),
    variableCount: countPlaceholders(body?.text),
  };
}

export const listTemplates = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(listTemplatesSchema)
  .handler(async ({ input, context }) => {
    const credentials = await resolveCampaignMetaCredentials(
      input.trackingId,
      context.org.id,
    );

    const response = await getMessageTemplates(
      credentials.accessToken,
      credentials.wabaId,
    );

    const templates = response.data
      .filter(
        (template) =>
          template.category === "MARKETING" || template.category === "UTILITY",
      )
      .map(summarize);

    return { templates };
  });
