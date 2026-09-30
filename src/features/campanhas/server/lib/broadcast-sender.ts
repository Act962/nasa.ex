import "server-only";
import { sendMarketingMessage, sendOfficialTemplate } from "@/http/whats-oficial";
import type { WhatsAppTemplateCategory } from "@/generated/prisma/enums";
import { toWhatsAppBrazilPhone } from "../../lib/whatsapp-phone";
import type {
  BroadcastTemplateMapping,
  BroadcastTemplateParam,
} from "../../schema/broadcast-schemas";

/**
 * Serviço de envio do disparo em massa (Fase 3). Resolve as variáveis `{{n}}`
 * de cada destinatário a partir do mapa salvo no broadcast e escolhe o endpoint
 * Meta pela categoria do template:
 *  - MARKETING → `/marketing_messages` (otimização + métricas de marketing)
 *  - UTILITY/AUTHENTICATION → `/messages` (o `/marketing_messages` rejeita
 *    templates não-marketing)
 *
 * Não passa pela PORT do chat de atendimento (que é outbound de conversa) —
 * resolve credenciais Meta direto, mesmo padrão do `create-template`.
 */

export interface BroadcastSenderCredentials {
  readonly accessToken: string;
  readonly phoneNumberId: string;
}

export interface BroadcastSenderRecipient {
  readonly name: string | null;
  readonly phone: string;
  readonly variables: unknown;
}

export interface BroadcastSendConfig {
  readonly templateName: string;
  readonly languageCode: string;
  readonly category: WhatsAppTemplateCategory;
  readonly mapping: BroadcastTemplateMapping;
}

function asCustomFields(variables: unknown): Record<string, string> {
  if (!variables || typeof variables !== "object") return {};
  return variables as Record<string, string>;
}

function resolveParam(
  param: BroadcastTemplateParam,
  recipient: BroadcastSenderRecipient,
): string {
  switch (param.source) {
    case "recipientName":
      return recipient.name?.trim() || param.value;
    case "recipientPhone":
      return recipient.phone;
    case "customField":
      return asCustomFields(recipient.variables)[param.value] ?? "";
    case "static":
    default:
      return param.value;
  }
}

export function resolveTemplateParams(
  params: ReadonlyArray<BroadcastTemplateParam>,
  recipient: BroadcastSenderRecipient,
): string[] {
  return params.map((param) => resolveParam(param, recipient));
}

export interface BroadcastSendResult {
  readonly wamid: string;
  /** Número canônico devolvido pela Meta — o mesmo que chega no webhook de resposta. */
  readonly waId: string;
  readonly headerParameters: string[];
  readonly bodyParameters: string[];
}

function assertParamsFilled(parameters: string[], section: string): void {
  const emptyIndex = parameters.findIndex((value) => value.trim() === "");
  if (emptyIndex === -1) return;
  throw new Error(
    `A variável {{${emptyIndex + 1}}} do ${section} ficou vazia para este contato.`,
  );
}

/**
 * Envia o template do broadcast pra um destinatário. Lança se alguma variável
 * resolver vazia (a Meta rejeitaria ou entregaria a frase quebrada) ou se a
 * Meta não devolver id — o chamador marca o recipient como FAILED.
 */
export async function sendBroadcastMessage(
  credentials: BroadcastSenderCredentials,
  config: BroadcastSendConfig,
  recipient: BroadcastSenderRecipient,
): Promise<BroadcastSendResult> {
  const headerParameters = resolveTemplateParams(config.mapping.header, recipient);
  const bodyParameters = resolveTemplateParams(config.mapping.body, recipient);
  assertParamsFilled(headerParameters, "cabeçalho");
  assertParamsFilled(bodyParameters, "corpo");

  // Rede de segurança: garante o 9º dígito BR mesmo em destinatários gravados
  // antes da normalização no atrelar (idempotente).
  const to = toWhatsAppBrazilPhone(recipient.phone);
  const message = {
    to,
    templateName: config.templateName,
    languageCode: config.languageCode,
    headerParameters: headerParameters.length ? headerParameters : undefined,
    bodyParameters: bodyParameters.length ? bodyParameters : undefined,
  };

  const response =
    config.category === "MARKETING"
      ? await sendMarketingMessage(
          credentials.accessToken,
          credentials.phoneNumberId,
          message,
        )
      : await sendOfficialTemplate(
          credentials.accessToken,
          credentials.phoneNumberId,
          message,
        );

  const wamid = response.messages?.[0]?.id;
  if (!wamid) {
    throw new Error("Meta não retornou o id da mensagem (wamid).");
  }
  return {
    wamid,
    waId: response.contacts?.[0]?.wa_id || to,
    headerParameters,
    bodyParameters,
  };
}
