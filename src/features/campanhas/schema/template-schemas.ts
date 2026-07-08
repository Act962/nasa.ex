import { z } from "zod";
import { TEMPLATE_LIMITS } from "../lib/template-constants";

/**
 * Schemas do builder de templates de marketing (Campanhas — Fase 2).
 *
 * O input estruturado (`createTemplateInputSchema`) é compartilhado entre o
 * formulário no client e o procedure no server; a montagem final pro payload
 * da Meta (`components[]` + `example`) vive em `lib/build-template-components.ts`.
 */

/** Nome do template: minúsculas, dígitos e underscore (regra da Meta). */
export const templateNameSchema = z
  .string()
  .min(1, "Dê um nome ao modelo")
  .max(TEMPLATE_LIMITS.name)
  .regex(
    /^[a-z0-9_]+$/,
    "Use apenas letras minúsculas, números e underscore (ex.: promo_julho)",
  );

export const templateHeaderSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("NONE") }),
  z.object({
    type: z.literal("TEXT"),
    text: z.string().min(1).max(TEMPLATE_LIMITS.headerText),
    /** Exemplo da variável `{{1}}` do header, quando houver. */
    example: z.string().optional(),
  }),
  z.object({ type: z.literal("IMAGE"), handle: z.string().min(1) }),
  z.object({ type: z.literal("VIDEO"), handle: z.string().min(1) }),
  z.object({ type: z.literal("DOCUMENT"), handle: z.string().min(1) }),
  z.object({ type: z.literal("LOCATION") }),
]);

export const templateBodySchema = z.object({
  text: z.string().min(1, "O corpo é obrigatório").max(TEMPLATE_LIMITS.bodyText),
  /** Exemplos das variáveis `{{1}}…{{n}}`, na ordem. */
  examples: z.array(z.string()).default([]),
});

export const templateButtonSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("QUICK_REPLY"),
    text: z.string().min(1).max(TEMPLATE_LIMITS.quickReplyText),
  }),
  z.object({
    type: z.literal("URL"),
    text: z.string().min(1).max(TEMPLATE_LIMITS.urlButtonText),
    urlType: z.enum(["STATIC", "DYNAMIC"]),
    url: z.string().min(1).max(TEMPLATE_LIMITS.url),
    /** Exemplo do sufixo dinâmico (`{{1}}` no fim da URL). */
    example: z.string().optional(),
  }),
  z.object({
    type: z.literal("PHONE_NUMBER"),
    text: z.string().min(1).max(TEMPLATE_LIMITS.phoneButtonText),
    phoneNumber: z.string().min(1),
  }),
  z.object({
    type: z.literal("COPY_CODE"),
    /** Código de oferta de exemplo. */
    example: z.string().min(1).max(TEMPLATE_LIMITS.copyCodeText),
  }),
]);

export const createTemplateInputSchema = z.object({
  name: templateNameSchema,
  language: z.string().min(1),
  category: z.literal("MARKETING"),
  header: templateHeaderSchema.default({ type: "NONE" }),
  body: templateBodySchema,
  footer: z.string().max(TEMPLATE_LIMITS.footerText).optional(),
  buttons: z.array(templateButtonSchema).max(TEMPLATE_LIMITS.maxButtons).default([]),
});

/** Input do procedure server-side (adiciona o tracking de origem). */
export const createTemplateSchema = createTemplateInputSchema.extend({
  trackingId: z.string().min(1),
});

export const listTemplatesSchema = z.object({
  trackingId: z.string().min(1),
});

export const uploadTemplateSampleSchema = z.object({
  trackingId: z.string().min(1),
  format: z.enum(["IMAGE", "VIDEO", "DOCUMENT"]),
  /** Arquivo em base64 (sem prefixo data URI). */
  base64: z.string().min(1),
  mimetype: z.string().min(1),
  filename: z.string().min(1),
});

export type TemplateHeaderInput = z.infer<typeof templateHeaderSchema>;
export type TemplateBodyInput = z.infer<typeof templateBodySchema>;
export type TemplateButtonInput = z.infer<typeof templateButtonSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateInputSchema>;
export type UploadTemplateSampleInput = z.infer<typeof uploadTemplateSampleSchema>;
