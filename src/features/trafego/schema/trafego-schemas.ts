import { z } from "zod";

export const trafegoPlatformSchema = z.enum(["META_ADS", "WHATSAPP_OFICIAL"]);

export const trafegoCampaignTypeSchema = z.enum([
  "PROSPECCAO",
  "REMARKETING",
  "VENDA_DIRETA",
  "RECONHECIMENTO",
  "RELACIONAMENTO",
]);

export const trafegoObjectiveSchema = z.enum([
  "LEADS",
  "TRAFFIC",
  "SALES",
  "AWARENESS",
  "ENGAGEMENT",
  "MESSAGES",
  "BROADCAST",
]);

export const trafegoOrderStatusSchema = z.enum([
  "PAID",
  "ONBOARDING",
  "MATERIALS_SUBMITTED",
  "REQUESTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
]);

/** Briefing coletado no wizard público, antes de existir pedido. */
export const trafegoBriefingSchema = z.object({
  businessName: z.string().trim().max(120).optional(),
  businessNiche: z.string().trim().max(120).optional(),
  targetAudience: z.string().trim().max(2000).optional(),
  destinationUrl: z.string().trim().url("URL inválida").max(500).optional().or(z.literal("")),
  whatsappNumber: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type TrafegoBriefing = z.infer<typeof trafegoBriefingSchema>;

/** Body de POST /api/checkout/trafego — endpoint público, sem auth. */
export const trafegoCheckoutBodySchema = z.object({
  planId: z.string().min(1),
  campaignType: trafegoCampaignTypeSchema,
  platform: trafegoPlatformSchema,
  objective: trafegoObjectiveSchema,
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  phone: z.string().trim().max(30).optional(),
  companyName: z.string().trim().max(120).optional(),
  briefing: trafegoBriefingSchema.optional(),
});

export type TrafegoCheckoutBody = z.infer<typeof trafegoCheckoutBodySchema>;

export const trafegoPlanInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen"),
  name: z.string().trim().min(2).max(80),
  headline: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  platform: trafegoPlatformSchema,
  campaignTypes: z.array(trafegoCampaignTypeSchema).min(1),
  objectives: z.array(trafegoObjectiveSchema).min(1),
  adBudgetBrlCents: z.number().int().min(0),
  serviceFeePercent: z.number().min(0).max(1000),
  serviceFeeBrlCents: z.number().int().min(0).nullable().optional(),
  durationDays: z.number().int().min(1).max(365),
  maxCreatives: z.number().int().min(1).max(20),
  maxCopies: z.number().int().min(1).max(20),
  highlights: z.array(z.string().trim().max(160)).max(12),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  position: z.number().int().min(0),
});

export const trafegoCopyInputSchema = z.object({
  headline: z.string().trim().max(120).optional(),
  primaryText: z.string().trim().min(1, "Escreva o texto do anúncio").max(3000),
  description: z.string().trim().max(300).optional(),
  callToAction: z.string().trim().max(60).optional(),
});

export const trafegoCreativeInputSchema = z.object({
  orderId: z.string().min(1),
  kind: z.enum(["IMAGE", "VIDEO"]),
  fileKey: z.string().min(1),
  fileName: z.string().max(300).optional(),
  fileSize: z.number().int().min(0).optional(),
  mimeType: z.string().max(120).optional(),
  width: z.number().int().min(0).optional(),
  height: z.number().int().min(0).optional(),
  durationSeconds: z.number().int().min(0).optional(),
});
