import "server-only";

import prisma from "@/lib/prisma";
import { MODEL_CATALOG } from "@/features/ia/lib/router/model-catalog";
import { estimateUsageCostUsd, type UsageForCostEstimate } from "@/features/ia/lib/token-pricing";
import { getMonetarySettings } from "@/features/stars/lib/metering";

/** Preço do modelo escolhido pelo usuário na chave da plataforma: custo do provedor + margem (spec 0055, RF-12). */

export const DEFAULT_ASTRO_MODEL_MARKUP_PERCENT = 50;
const MINIMUM_CHARGE_STARS = 1;

export interface AstroModelPricingSettings {
  markupPercent: number;
  /** Modelos liberados na chave da plataforma. */
  platformModelIds: string[];
}

export function listCatalogModelIds(): string[] {
  return [...new Set(MODEL_CATALOG.map((model) => model.id))];
}

/** Colunas ainda não migradas: valem os padrões (50% e todos os modelos). */
export async function getAstroModelPricingSettings(): Promise<AstroModelPricingSettings> {
  try {
    const settings = await prisma.routerPaymentSettings.findFirst({
      select: { astroModelMarkupPercent: true, astroPlatformModelIds: true },
    });
    const storedModelIds = (settings?.astroPlatformModelIds ?? []).filter((modelId) => listCatalogModelIds().includes(modelId));
    return {
      markupPercent: settings?.astroModelMarkupPercent ?? DEFAULT_ASTRO_MODEL_MARKUP_PERCENT,
      platformModelIds: storedModelIds.length > 0 ? storedModelIds : listCatalogModelIds(),
    };
  } catch (readError) {
    console.warn("[ai-credits] preço dos modelos indisponível (migração aplicada?):", readError);
    return { markupPercent: DEFAULT_ASTRO_MODEL_MARKUP_PERCENT, platformModelIds: listCatalogModelIds() };
  }
}

export async function saveAstroModelPricingSettings(params: {
  markupPercent: number;
  platformModelIds: string[];
  updatedById: string;
}) {
  const existing = await prisma.routerPaymentSettings.findFirst({ select: { id: true } });
  const data = {
    astroModelMarkupPercent: params.markupPercent,
    astroPlatformModelIds: params.platformModelIds.filter((modelId) => listCatalogModelIds().includes(modelId)),
    updatedById: params.updatedById,
  };
  if (existing) {
    await prisma.routerPaymentSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.routerPaymentSettings.create({ data: { id: "default", ...data } });
  }
}

/** Admin do sistema ou e-mail listado em `AI_PRICING_ADMIN_EMAILS` (super usuário sem acesso ao /admin inteiro). */
export async function canManageAstroModelPricing(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, isSystemAdmin: true } });
  if (!user) return false;
  if (user.isSystemAdmin) return true;
  const allowedEmails = (process.env.AI_PRICING_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return allowedEmails.includes(user.email.toLowerCase());
}

/** Stars de uma resposta com modelo escolhido na chave da plataforma: custo em US$ × (1 + margem), em Stars. */
export async function computeChosenModelStars(usage: UsageForCostEstimate): Promise<{ stars: number; costUsd: number; markupPercent: number }> {
  const [{ markupPercent }, { usdToBrlRate, starPriceBrl }] = await Promise.all([
    getAstroModelPricingSettings(),
    getMonetarySettings(),
  ]);
  const { usd: costUsd } = estimateUsageCostUsd(usage);
  const chargedBrl = costUsd * (1 + markupPercent / 100) * usdToBrlRate;
  const stars = starPriceBrl > 0 ? Math.max(MINIMUM_CHARGE_STARS, Math.ceil(chargedBrl / starPriceBrl)) : MINIMUM_CHARGE_STARS;
  return { stars, costUsd, markupPercent };
}
