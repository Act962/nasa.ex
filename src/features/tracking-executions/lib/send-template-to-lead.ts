/**
 * Envio de template aprovado da API Oficial pelas automações (spec 0077).
 * É o único tipo de mensagem que a Meta aceita fora da janela de 24h — os
 * mesmos modelos criados no app de Campanhas.
 */
import "server-only";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { Prisma } from "@/generated/prisma/client";
import { renderTemplateText } from "@/features/campanhas/lib/template-variables";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import {
  ProviderFeatureUnsupportedError,
  type ResolvedOutboundProvider,
} from "@/features/tracking-chat/lib/providers";
import {
  type CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import {
  resolveWorkflowProvider,
  sendWithWorkflowErrors,
  toWorkflowSendError,
} from "./workflow-outbound";

/** Template com as variáveis `{{n}}` já resolvidas para o lead. */
export interface WorkflowTemplateContent {
  readonly templateName: string;
  readonly languageCode: string;
  readonly headerText: string | null;
  readonly bodyText: string;
  readonly headerParameters: string[];
  readonly bodyParameters: string[];
}

export function assertTemplateSupported(resolved: ResolvedOutboundProvider): void {
  if (resolved.providerId === "meta-cloud") return;
  throw toWorkflowSendError(
    new ProviderFeatureUnsupportedError(resolved.providerId, "template"),
  );
}

function assertParametersFilled(parameters: string[], section: string): void {
  const emptyIndex = parameters.findIndex((value) => value.trim() === "");
  if (emptyIndex === -1) return;
  throw new NonRetriableError(
    `A variável {{${emptyIndex + 1}}} do ${section} do template ficou vazia para este lead.`,
  );
}

/**
 * Tudo o que impede o envio e dá pra saber sem chamar a Meta. Roda antes de
 * cobrar Stars: variável vazia não pode custar uma mensagem que não saiu.
 */
export function assertTemplateSendable(
  resolved: ResolvedOutboundProvider,
  template: WorkflowTemplateContent,
): void {
  assertTemplateSupported(resolved);
  assertParametersFilled(template.headerParameters, "título");
  assertParametersFilled(template.bodyParameters, "corpo");
}

/**
 * Lê o template salvo no nó (tipo TEMPLATE ou template reserva) e resolve as
 * variáveis com o interpolador da engine que está executando.
 */
export function toWorkflowTemplateContent(
  rawTemplate: unknown,
  interpolateParameter: (parameter: string) => string,
): WorkflowTemplateContent | null {
  if (!rawTemplate || typeof rawTemplate !== "object") return null;
  const template = rawTemplate as Record<string, unknown>;
  const templateName =
    typeof template.templateName === "string" ? template.templateName : "";
  const languageCode =
    typeof template.languageCode === "string" ? template.languageCode : "";
  if (!templateName || !languageCode) return null;

  const toInterpolatedParameters = (rawParameters: unknown): string[] =>
    Array.isArray(rawParameters)
      ? rawParameters.map((parameter) =>
          interpolateParameter(String(parameter ?? "")).trim(),
        )
      : [];

  return {
    templateName,
    languageCode,
    headerText:
      typeof template.headerText === "string" ? template.headerText : null,
    bodyText: typeof template.bodyText === "string" ? template.bodyText : "",
    headerParameters: toInterpolatedParameters(template.headerParameters),
    bodyParameters: toInterpolatedParameters(template.bodyParameters),
  };
}

function renderTemplateBody(template: WorkflowTemplateContent): string {
  const body = renderTemplateText(template.bodyText, template.bodyParameters);
  const header = template.headerText
    ? renderTemplateText(template.headerText, template.headerParameters)
    : null;
  const rendered = header ? `${header}\n\n${body}` : body;
  return rendered.trim() || `[Template: ${template.templateName}]`;
}

/**
 * Template abre conversa: o lead pode nunca ter escrito, então a conversa é
 * criada aqui quando ainda não existe.
 */
export async function ensureLeadConversation(
  trackingId: string,
  lead: { id: string; phone: string },
): Promise<string> {
  try {
    const conversation = await prisma.conversation.upsert({
      where: { leadId_trackingId: { leadId: lead.id, trackingId } },
      create: {
        trackingId,
        leadId: lead.id,
        remoteJid: `${lead.phone.replace(/\D/g, "")}@s.whatsapp.net`,
        isActive: true,
      },
      update: {},
      select: { id: true },
    });
    return conversation.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new NonRetriableError(
        "Já existe uma conversa com este número ligada a outro lead.",
      );
    }
    throw error;
  }
}

export async function sendTemplateMessage(params: {
  resolved: ResolvedOutboundProvider;
  conversationId: string;
  toPhone: string;
  template: WorkflowTemplateContent;
}): Promise<{ messageId: string }> {
  const { resolved, template } = params;
  assertTemplateSendable(resolved, template);

  const sent = await sendWithWorkflowErrors(() =>
    resolved.provider.sendTemplate({
      kind: "template",
      to: params.toPhone,
      templateName: template.templateName,
      languageCode: template.languageCode,
      headerParameters: template.headerParameters.length
        ? template.headerParameters
        : undefined,
      bodyParameters: template.bodyParameters.length
        ? template.bodyParameters
        : undefined,
    }),
  );

  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      body: renderTemplateBody(template),
      messageId: sent.externalMessageId,
      fromMe: true,
      status: MessageStatus.SENT,
      quotedMessageId: null,
      metadata: { source: "workflow", templateName: template.templateName },
    },
    include: { conversation: { include: { lead: true } } },
  });

  const messageCreated: CreatedMessageProps = {
    ...message,
    currentUserId: "system",
  };
  await pusherServer
    .trigger(message.conversationId, "message:created", messageCreated)
    .catch(() => {
      // Pusher é best-effort: a mensagem já está no banco.
    });

  return { messageId: message.id };
}

/** Versão completa (lead → conversa → cobrança → envio) para o modo agente. */
export async function sendTemplateToLead(params: {
  leadId: string;
  trackingId: string;
  template: WorkflowTemplateContent;
}): Promise<{ messageId: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: {
      id: true,
      phone: true,
      isActive: true,
      tracking: { select: { organizationId: true } },
    },
  });
  if (!lead) throw new NonRetriableError("Lead not found");
  if (!lead.isActive) throw new NonRetriableError("Lead is not active");
  if (!lead.phone) throw new NonRetriableError("Lead phone is missing");

  const resolved = await resolveWorkflowProvider(params.trackingId);
  assertTemplateSendable(resolved, params.template);

  const conversationId = await ensureLeadConversation(params.trackingId, {
    id: lead.id,
    phone: lead.phone,
  });

  const charge = await chargeStarsByAction(
    lead.tracking.organizationId,
    "message_send",
    {
      appSlug: "message_send",
      description: "Workflow tracking — envio de template",
    },
  );
  if (!charge.success) {
    throw new NonRetriableError(
      "Saldo de STARs insuficiente pra envio automático.",
    );
  }

  return sendTemplateMessage({
    resolved,
    conversationId,
    toPhone: lead.phone,
    template: params.template,
  });
}
