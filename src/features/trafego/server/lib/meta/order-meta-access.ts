import "server-only";

import prisma from "@/lib/prisma";
import { actId, type MetaAuth } from "@/http/meta/ads-management";
import { getAdAccountInfo, type MetaAdAccountInfo } from "@/http/meta/ads-account";
import { MetaGraphError } from "@/http/meta/graph-client";
import { readMetaAccessToken, readMetaAppSecret } from "@/features/integrations/lib/integration-api-key";
import { buildMetaReadCacheKey, readThroughMetaCache } from "./meta-read-cache";

/**
 * De onde o trafeGO lê os números de um pedido (spec 0122, RF-11, D-1):
 * a integração Meta dos Satélites da ORG DO PEDIDO. Sem integração, o pedido
 * segue no modo antigo (agência). Nunca troca de conta em silêncio.
 */

export type OrderMetaUnavailableReason = "token_invalid" | "no_access" | "rate_limited" | "error";

export type OrderMetaAccess =
  | {
      mode: "account";
      organizationId: string;
      auth: MetaAuth;
      account: MetaAdAccountInfo;
    }
  | { mode: "legacy" }
  | { mode: "unavailable"; reason: OrderMetaUnavailableReason; message: string };

export function toOrderMetaUnavailable(error: unknown): Extract<OrderMetaAccess, { mode: "unavailable" }> {
  if (error instanceof MetaGraphError) {
    if (error.kind === "token_invalid") return { mode: "unavailable", reason: "token_invalid", message: error.userMessage };
    if (error.kind === "permission") {
      return {
        mode: "unavailable",
        reason: "no_access",
        message: "A conexão com a Meta não tem acesso a esta conta de anúncios.",
      };
    }
    if (error.kind === "rate_limited") return { mode: "unavailable", reason: "rate_limited", message: error.userMessage };
    return { mode: "unavailable", reason: "error", message: error.userMessage };
  }
  return { mode: "unavailable", reason: "error", message: "Não foi possível ler os números da Meta agora." };
}

export async function resolveOrderMetaAccess(order: { organizationId: string }): Promise<OrderMetaAccess> {
  const integration = await prisma.platformIntegration.findUnique({
    where: { organizationId_platform: { organizationId: order.organizationId, platform: "META" } },
    select: { isActive: true, config: true },
  });
  if (!integration?.isActive) return { mode: "legacy" };

  const config = (integration.config ?? null) as Record<string, unknown> | null;
  const accessToken = readMetaAccessToken(config);
  const configuredAccountId = typeof config?.adAccountId === "string" ? config.adAccountId.trim() : "";
  if (!accessToken || !configuredAccountId) return { mode: "legacy" };

  const auth: MetaAuth = {
    accessToken,
    adAccountId: actId(configuredAccountId),
    appSecret: readMetaAppSecret(config),
  };

  try {
    // A org entra na chave: outra org apontando para a mesma conta não herda o acesso desta.
    const account = await readThroughMetaCache(
      buildMetaReadCacheKey({
        block: "account",
        org: order.organizationId,
        act: auth.adAccountId,
        token: typeof config?.accessTokenLast4 === "string" ? config.accessTokenLast4 : null,
      }),
      () => getAdAccountInfo(auth, auth.adAccountId),
    );
    return { mode: "account", organizationId: order.organizationId, auth, account };
  } catch (accountError) {
    return toOrderMetaUnavailable(accountError);
  }
}
