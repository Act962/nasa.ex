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
  })
  .partial();

export type AstroRouteContext = z.infer<typeof astroRouteContextSchema>;

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
});

export type AstroChatRequest = z.infer<typeof astroChatRequestSchema>;
