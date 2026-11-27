import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { WhatsAppProvider } from "@/generated/prisma/enums";
import { decryptStoredMetaCredentialsPartial } from "@/features/tracking-chat/lib/providers/meta-credentials";
import { getMessageTemplates } from "@/http/whats-oficial";
import type { MessageTemplate } from "@/http/whats-oficial";
import z from "zod";

/**
 * Lista os templates HSM aprovados da WABA de um tracking `META_CLOUD`
 * (Fase 9). Fetch ao vivo da Graph API — sem persistência local nesta fase.
 *
 * Devolve um shape enxuto pra UI: nome, idioma, categoria, texto do corpo,
 * contagem de variáveis (body + header de texto) e tipo de header. Templates
 * com header de mídia (`IMAGE`/`VIDEO`/`DOCUMENT`) NÃO são enviáveis nesta
 * fase — sinalizamos via `sendable: false` pra UI ocultar/avisar.
 */

export interface WhatsAppTemplateSummary {
  name: string;
  language: string;
  category: string;
  bodyText: string;
  bodyVariableCount: number;
  headerType: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  headerText: string | null;
  headerVariableCount: number;
  /** `false` quando o template usa recursos não suportados no envio (Fase 9). */
  sendable: boolean;
}

function countPlaceholders(text: string | undefined): number {
  if (!text) return 0;
  const matches = text.match(/\{\{\s*\d+\s*\}\}/g);
  return matches ? new Set(matches).size : 0;
}

export function summarizeTemplate(template: MessageTemplate): WhatsAppTemplateSummary {
  const body = template.components.find((component) => component.type === "BODY");
  const header = template.components.find(
    (component) => component.type === "HEADER",
  );
  const hasButtons = template.components.some(
    (component) => component.type === "BUTTONS",
  );

  const headerType = (header?.format ?? (header ? "TEXT" : "NONE")) as
    WhatsAppTemplateSummary["headerType"];
  const headerVariableCount =
    headerType === "TEXT" ? countPlaceholders(header?.text) : 0;

  // Enviável nesta fase: header inexistente ou de TEXTO. Header de mídia e
  // botões dinâmicos ficam pra Fase 10 (o envio só preenche body/header-texto).
  const sendable =
    (headerType === "NONE" || headerType === "TEXT") && !hasButtons;

  return {
    name: template.name,
    language: template.language,
    category: template.category,
    bodyText: body?.text ?? "",
    bodyVariableCount: countPlaceholders(body?.text),
    headerType,
    headerText: headerType === "TEXT" ? (header?.text ?? null) : null,
    headerVariableCount,
    sendable,
  };
}

/** Por que a lista não sai, em texto para a pessoa (ou a IA) entender. */
export class TemplateListError extends Error {
  constructor(
    message: string,
    readonly kind: "not_found" | "unsupported" | "incomplete",
  ) {
    super(message);
  }
}

/**
 * Templates aprovados da WABA do número. Usado pela tela e pelo MCP do FlowAstro (spec 0144, RF-7). Confere que o
 * número é da empresa antes de falar com a Meta.
 */
export async function loadApprovedTemplates(params: { trackingId: string; organizationId: string }): Promise<WhatsAppTemplateSummary[]> {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId: params.trackingId },
    select: {
      organizationId: true,
      provider: true,
      metaAccessToken: true,
      metaPhoneNumberId: true,
      metaAppSecret: true,
      metaVerifyToken: true,
      metaBusinessAccountId: true,
    },
  });
  if (!instance || instance.organizationId !== params.organizationId) {
    throw new TemplateListError("Instância não encontrada", "not_found");
  }
  if (instance.provider !== WhatsAppProvider.META_CLOUD) {
    throw new TemplateListError("Templates só estão disponíveis para instâncias com a API Oficial (Meta Cloud).", "unsupported");
  }
  if (!instance.metaBusinessAccountId) {
    throw new TemplateListError("Conta WhatsApp Business (WABA) não configurada. Reconecte a instância via Meta.", "incomplete");
  }
  const credentials = decryptStoredMetaCredentialsPartial({
    metaAccessToken: instance.metaAccessToken,
    metaPhoneNumberId: instance.metaPhoneNumberId,
    metaAppSecret: instance.metaAppSecret,
    metaVerifyToken: instance.metaVerifyToken,
    metaBusinessAccountId: instance.metaBusinessAccountId,
  });
  const response = await getMessageTemplates(credentials.accessToken, instance.metaBusinessAccountId);
  return response.data.filter((template) => template.status === "APPROVED").map(summarizeTemplate);
}

export const listWhatsAppTemplates = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/integrations/whatsapp-templates",
    summary: "List approved Meta Cloud message templates for a tracking",
    tags: ["Integrations", "WhatsApp Provider"],
  })
  .input(z.object({ trackingId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    try {
      return { templates: await loadApprovedTemplates({ trackingId: input.trackingId, organizationId: context.org.id }) };
    } catch (error) {
      if (!(error instanceof TemplateListError)) throw error;
      if (error.kind === "not_found") throw errors.NOT_FOUND({ message: error.message });
      throw errors.BAD_REQUEST({
        message: error.message,
        data: { code: error.kind === "unsupported" ? "PROVIDER_FEATURE_UNSUPPORTED" : "META_CREDENTIALS_INCOMPLETE" } as never,
      });
    }
  });
