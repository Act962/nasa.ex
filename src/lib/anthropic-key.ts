import "server-only";

import prisma from "@/lib/prisma";

/**
 * Resolve a API key da Anthropic na ordem:
 *  1. Env var `ANTHROPIC_API_KEY` (configurada no servidor)
 *  2. PlatformIntegration ativa da org (`platform: "ANTHROPIC"`)
 *  3. Chave configurada em qualquer NasaPlanner da org
 *
 * Devolve `null` quando nada está configurado — caller mostra mensagem
 * explicando como configurar.
 *
 * Centralizado aqui porque era duplicado em `/api/ai/extract-brand` e
 * agora também é necessário em `/api/public-calendar/quick-create-from-image`.
 */
export async function resolveAnthropicApiKey(
  organizationId: string,
): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;

  const integration = await prisma.platformIntegration.findFirst({
    where: { organizationId, platform: "ANTHROPIC", isActive: true },
    select: { config: true },
  });
  const integrationKey = (integration?.config as Record<string, string> | null)?.apiKey;
  if (integrationKey) return integrationKey;

  const planner = await prisma.nasaPlanner.findFirst({
    where: { organizationId, anthropicApiKey: { not: null } },
    select: { anthropicApiKey: true },
    orderBy: { updatedAt: "desc" },
  });

  return planner?.anthropicApiKey ?? null;
}
