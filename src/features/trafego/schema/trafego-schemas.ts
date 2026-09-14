import { z } from "zod";
import { MAX_AD_BUDGET_BRL_CENTS } from "@/features/trafego/lib/pricing-tiers";

export const trafegoPlatformSchema = z.enum(["META_ADS", "GOOGLE_ADS", "WHATSAPP_OFICIAL"]);

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
  "SEARCH",
]);

export const trafegoOrderStatusSchema = z.enum([
  "PAID",
  "ACCOUNT_REVIEW",
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

export const businessManagerAnswerSchema = z.enum(["yes", "no", "unsure"]);

/**
 * Body de POST /api/checkout/trafego — endpoint público, sem auth.
 *
 * O preço vem do simulador por faixa: o cliente escolhe a verba e o servidor
 * recalcula taxa e setup. Nada de valor vindo do browser.
 */
export const trafegoCheckoutBodySchema = z.object({
  // Recusa acima do teto em vez de reduzir em silêncio: cobrar menos do que o
  // cliente pediu sem avisar seria pior que devolver erro.
  adBudgetBrlCents: z
    .number()
    .int()
    .min(0)
    .max(MAX_AD_BUDGET_BRL_CENTS, {
      message:
        "Para investimentos acima de R$ 500.000 fale com um gestor — o checkout automático não cobre esse valor.",
    }),
  hasBusinessManager: businessManagerAnswerSchema,
  campaignType: trafegoCampaignTypeSchema,
  platform: trafegoPlatformSchema,
  objective: trafegoObjectiveSchema,
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  /// Obrigatório: é por ele que o comprovante cai no card e os avisos chegam.
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((value) => value.replace(/\D/g, "").length >= 10, "Informe um WhatsApp válido com DDD"),
  companyName: z.string().trim().max(120).optional(),
  briefing: trafegoBriefingSchema.optional(),
  /// @ do Instagram ou página do Facebook (Meta Ads) — o preview vem do lookup.
  socialHandle: z.string().trim().max(120).optional(),
  /// WhatsApp Oficial: tem número na API? Sem número = setup (mesma tabela da BM).
  hasOfficialNumber: businessManagerAnswerSchema.optional(),
  officialNumber: z.string().trim().max(30).optional(),
  /// Cartão abre o Stripe; PIX devolve a chave e espera o comprovante.
  paymentMethod: z.enum(["CARD", "PIX"]).default("CARD"),
  /// Cliente leu o alerta de política e escolheu seguir. Obrigatório quando a
  /// checagem devolve WARNING — o servidor confere de novo antes de cobrar.
  complianceAcknowledged: z.boolean().default(false),
  /// Prazo: o que o cliente quer, o que é possível e o reconhecimento quando
  /// as duas datas não batem. O servidor recalcula o possível — o browser só informa.
  desiredStartAt: z.string().trim().max(20).optional(),
  hasSocialLinked: z.boolean().optional(),
  materialsReady: z.boolean().optional(),
  startAcknowledged: z.boolean().default(false),
  /// Aceite explícito dos termos. Sem isto o checkout é recusado — é a prova
  /// de que o cliente leu a cláusula sobre responsabilidade pelo criativo.
  acceptedTerms: z.literal(true, {
    message: "É necessário aceitar os termos para continuar.",
  }),
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
  adBudgetBrlCents: z.number().int().min(0).max(MAX_AD_BUDGET_BRL_CENTS),
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
