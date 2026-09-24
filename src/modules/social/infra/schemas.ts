import { z } from "zod";

/**
 * Contratos do que viaja em `Json` no banco. O domínio trabalha com tipos TS;
 * é aqui, na fronteira, que o `Json` vira tipo confiável — e é aqui que um
 * dado velho ou torto é rejeitado, não três camadas adiante.
 */

export const channelCredentialsSchema = z.object({
  accessToken: z.string().min(1),
  appSecret: z.string().min(1),
  verifyToken: z.string().min(1),
});

export const messageButtonSchema = z.object({
  type: z.literal("URL").default("URL"),
  title: z.string().min(1).max(20),
  url: z.string().url(),
});

export const sendDirectMessageConfigSchema = z.object({
  source: z.enum(["STATIC", "AI"]).default("STATIC"),
  text: z.string().max(4000).optional(),
  aiPrompt: z.string().max(2000).optional(),
  buttons: z.array(messageButtonSchema).max(3).default([]),
});

export const replyToCommentConfigSchema = z.object({
  variants: z.array(z.string().max(300)).max(10).default([]),
  strategy: z.enum(["RANDOM", "SEQUENTIAL"]).default("RANDOM"),
});

export type ChannelCredentialsInput = z.infer<typeof channelCredentialsSchema>;

/** Fallback seguro: config corrompida vira passo vazio, não exceção no webhook. */
export function parseStepConfig(
  kind: "SEND_DIRECT_MESSAGE" | "REPLY_TO_COMMENT",
  raw: unknown,
) {
  if (kind === "SEND_DIRECT_MESSAGE") {
    const parsed = sendDirectMessageConfigSchema.safeParse(raw ?? {});
    return parsed.success
      ? parsed.data
      : { source: "STATIC" as const, buttons: [] };
  }
  const parsed = replyToCommentConfigSchema.safeParse(raw ?? {});
  return parsed.success
    ? parsed.data
    : { variants: [], strategy: "RANDOM" as const };
}
