import { z } from "zod";

/**
 * Contexto da rota atual injetado pelo cliente. Snapshot dos IDs relevantes
 * que o ASTRO usa para orientar a resposta. Tudo opcional — o orquestrador
 * decide se carrega entidades sob demanda.
 */
export const astroRouteContextSchema = z
  .object({
    pathname: z.string().optional(),
    organizationId: z.string().optional(),
    trackingId: z.string().optional(),
    leadId: z.string().optional(),
    conversationId: z.string().optional(),
    workspaceId: z.string().optional(),
    actionId: z.string().optional(),
    /** Aba aberta em /payment (dashboard, payables, documents...). */
    paymentTab: z.string().optional(),
    /** Subaba dentro da aba do /payment (ex.: `?sub=` da aba Contábil). */
    paymentSubTab: z.string().optional(),
  })
  .partial();

export type AstroRouteContext = z.infer<typeof astroRouteContextSchema>;

/**
 * Data part que carrega um anexo já enviado ao storage (spec 0014, D-3). O
 * arquivo sobe por `/api/payment/attachments/upload` antes da mensagem; aqui
 * viaja só a referência.
 */
export const ASTRO_ATTACHMENT_PART_TYPE = "data-astro-attachment" as const;

export const astroAttachmentDataSchema = z.object({
  attachmentId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export type AstroAttachmentData = z.infer<typeof astroAttachmentDataSchema>;

export const astroAttachmentPartSchema = z.object({
  type: z.literal(ASTRO_ATTACHMENT_PART_TYPE),
  data: astroAttachmentDataSchema,
});

/** Extrai os anexos declarados numa UIMessage, ignorando parts de outros tipos. */
export function extractAttachmentRefs(message: {
  parts?: unknown[];
}): AstroAttachmentData[] {
  if (!Array.isArray(message.parts)) return [];
  const refs: AstroAttachmentData[] = [];
  for (const part of message.parts) {
    const parsed = astroAttachmentPartSchema.safeParse(part);
    if (parsed.success) refs.push(parsed.data.data);
  }
  return refs;
}

/**
 * Body do POST /api/astro/chat. `messages` é o array de UIMessage do AI SDK
 * (validação leve aqui; o cast forte fica no handler com os tipos do AI SDK).
 */
export const astroChatRequestSchema = z.object({
  // UIMessage[] — validação estrutural mínima
  messages: z.array(
    z.object({
      id: z.string().optional(),
      role: z.enum(["user", "assistant", "system"]),
      parts: z.array(z.any()).optional(),
      content: z.string().optional(),
    }),
  ),
  sessionId: z.string().optional(),
  context: astroRouteContextSchema.optional(),
  pinnedAgentKey: z.string().optional(), // embed: força um sub-agente
  /** Modelo escolhido no "Uso do ASTRO" (spec 0055, RF-11); o servidor só aceita os da chave própria. */
  preferredModelId: z.string().max(80).optional(),
  /** IAs ligadas, em ordem de prioridade (spec 0055, RF-15). */
  providerOrder: z.array(z.enum(["openai", "google", "anthropic"])).max(3).optional(),
  /** Modelos de texto desligados (spec 0055, RF-16). */
  disabledModelIds: z.array(z.string().max(80)).max(40).optional(),
});

export type AstroChatRequest = z.infer<typeof astroChatRequestSchema>;
