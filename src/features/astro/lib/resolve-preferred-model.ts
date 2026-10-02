import "server-only";

import { MODEL_CATALOG } from "@/features/ia/lib/router/model-catalog";
import { envKeyFor, loadOrganizationKeys, type AiProviderId } from "@/features/ia/lib/router/providers";
import { isProviderExhausted } from "@/features/ai-credits/lib/provider-exhaustion";
import { getAstroModelPricingSettings } from "@/features/ai-credits/lib/model-pricing-settings";

/**
 * Modelo escolhido pelo usuário no "Uso do ASTRO" (spec 0055, RF-11/RF-12). Chave própria da empresa
 * vence; senão vale a chave da plataforma, se o modelo estiver liberado pelo admin — e aí a resposta
 * é cobrada pelo custo do modelo com margem (`isPlatformKey`).
 */
export async function resolvePreferredModelOverride(
  organizationId: string,
  preferredModelId: string | undefined,
): Promise<{ provider: AiProviderId; modelId: string; isPlatformKey: boolean } | null> {
  if (!preferredModelId) return null;
  const catalogModel = MODEL_CATALOG.find((model) => model.id === preferredModelId);
  if (!catalogModel) return null;

  const organizationKeys = await loadOrganizationKeys(organizationId);
  const isOwnKeyUsable =
    Boolean(organizationKeys[catalogModel.provider]) && !isProviderExhausted({ organizationId, provider: catalogModel.provider });
  if (isOwnKeyUsable) return { provider: catalogModel.provider, modelId: catalogModel.id, isPlatformKey: false };

  const isPlatformKeyUsable =
    Boolean(envKeyFor(catalogModel.provider)) && !isProviderExhausted({ organizationId: null, provider: catalogModel.provider });
  if (!isPlatformKeyUsable) return null;
  const { platformModelIds } = await getAstroModelPricingSettings();
  if (!platformModelIds.includes(catalogModel.id)) return null;
  return { provider: catalogModel.provider, modelId: catalogModel.id, isPlatformKey: true };
}
