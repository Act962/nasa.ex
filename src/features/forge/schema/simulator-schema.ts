// Schemas Zod do Simulador de Custos, compartilhados entre as procedures oRPC
// e os formulários do builder. Números chegam como number; o servidor resolve
// as taxas pelo catálogo e persiste como Decimal.

import { z } from "zod";

export const priceCategorySchema = z.enum([
  "AI_MODEL",
  "WHATSAPP_CONVERSATION",
  "INFRA_SERVER",
  "HOSTING",
  "STORAGE",
  "DATABASE",
  "LABOR",
  "OTHER",
]);

export const priceUnitSchema = z.enum([
  "PER_1K_TOKENS",
  "PER_CONVERSATION",
  "PER_MONTH",
  "PER_HOUR",
  "PER_GB_MONTH",
  "PER_COMPUTE_HOUR",
  "FLAT",
]);

export const priceCurrencySchema = z.enum(["BRL", "USD"]);
export const simulationModeSchema = z.enum(["COMERCIAL", "LICITACAO"]);
export const whatsappCategorySchema = z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]);

export const simulationWhatsappLineSchema = z.object({
  priceItemId: z.string(),
  conversationsPerUser: z.number().min(0).default(0),
});

export const simulationOperationalLineSchema = z.object({
  priceItemId: z.string(),
  quantity: z.number().min(0).default(1),
});

export const bidItemInputSchema = z.object({
  code: z.string().min(1),
  parentCode: z.string().nullish(),
  description: z.string().min(1),
  unit: z.string().default("SV"),
  quantity: z.number().min(0).default(1),
  internalUnitCostBrl: z.number().min(0).default(0),
  markupPercentage: z.number().nullish(),
  ceilingUnitBrl: z.number().nullish(),
  priceItemId: z.string().nullish(),
  order: z.number().int().default(0),
});

export const simulationInputSchema = z.object({
  name: z.string().min(1),
  mode: simulationModeSchema.default("COMERCIAL"),
  markupPercentage: z.number().min(0).default(0),
  // Comercial
  userCount: z.number().int().min(0).default(1),
  aiPriceItemId: z.string().nullish(),
  inputTokensPerUser: z.number().int().min(0).default(0),
  outputTokensPerUser: z.number().int().min(0).default(0),
  cachedTokensPerUser: z.number().int().min(0).default(0),
  whatsappEnabled: z.boolean().default(false),
  whatsapp: z.array(simulationWhatsappLineSchema).default([]),
  operational: z.array(simulationOperationalLineSchema).default([]),
  // Licitação
  bidOrg: z.string().nullish(),
  bidNumber: z.string().nullish(),
  contractMonths: z.number().int().min(1).default(12),
  ceilingTotalBrl: z.number().nullish(),
  bidItems: z.array(bidItemInputSchema).default([]),
});

export const createSimulationSchema = simulationInputSchema;
export const updateSimulationSchema = simulationInputSchema.partial().extend({
  id: z.string(),
});

export type SimulationInput = z.infer<typeof simulationInputSchema>;
export type BidItemInputPayload = z.infer<typeof bidItemInputSchema>;
export type SimulationWhatsappLine = z.infer<typeof simulationWhatsappLineSchema>;
export type SimulationOperationalLine = z.infer<typeof simulationOperationalLineSchema>;
