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

function summarizeTemplate(template: MessageTemplate): WhatsAppTemplateSummary {
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
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { trackingId: input.trackingId },
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

    if (!instance || instance.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Instância não encontrada" });
    }

    if (instance.provider !== WhatsAppProvider.META_CLOUD) {
      throw errors.BAD_REQUEST({
        message:
          "Templates só estão disponíveis para instâncias com a API Oficial (Meta Cloud).",
        data: { code: "PROVIDER_FEATURE_UNSUPPORTED" } as never,
      });
    }

    if (!instance.metaBusinessAccountId) {
      throw errors.BAD_REQUEST({
        message:
          "Conta WhatsApp Business (WABA) não configurada. Reconecte a instância via Meta.",
        data: { code: "META_CREDENTIALS_INCOMPLETE" } as never,
      });
    }

    const credentials = decryptStoredMetaCredentialsPartial({
      metaAccessToken: instance.metaAccessToken,
      metaPhoneNumberId: instance.metaPhoneNumberId,
      metaAppSecret: instance.metaAppSecret,
      metaVerifyToken: instance.metaVerifyToken,
      metaBusinessAccountId: instance.metaBusinessAccountId,
    });

    const response = await getMessageTemplates(
      credentials.accessToken,
      instance.metaBusinessAccountId,
    );

    const templates = response.data
      .filter((template) => template.status === "APPROVED")
      .map(summarizeTemplate);

    return { templates };
  });
