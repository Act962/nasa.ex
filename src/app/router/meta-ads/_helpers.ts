import prisma from "@/lib/prisma";
import { MetaAccountKind } from "@/generated/prisma/enums";
import { getAuthorizedAccountKeys } from "./_access";

export type MetaAuth = { accessToken: string; adAccountId: string };

type AdAccountEntry = {
  id?: string;
  account_id?: string;
};

function normalizeAdAccountId(raw: string): string {
  if (!raw) return raw;
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

function pickAdAccountIdFromConfig(config: Record<string, unknown>): string | null {
  const list = (config.adAccounts as AdAccountEntry[] | undefined) ?? [];
  const selected = (config.selectedAdAccountIds as string[] | undefined) ?? [];

  if (selected.length > 0) return normalizeAdAccountId(selected[0]);

  const first = list[0];
  if (!first) return null;
  const raw = first.account_id ?? first.id ?? "";
  return raw ? normalizeAdAccountId(raw) : null;
}

function isAdAccountInConfig(config: Record<string, unknown>, accountId: string): boolean {
  const list = (config.adAccounts as AdAccountEntry[] | undefined) ?? [];
  const selected = ((config.selectedAdAccountIds as string[] | undefined) ?? []).map(normalizeAdAccountId);
  const target = normalizeAdAccountId(accountId);
  if (selected.includes(target)) return true;
  return list.some((a) => normalizeAdAccountId(a.account_id ?? a.id ?? "") === target);
}

/**
 * getMetaAuth — resolve `{ accessToken, adAccountId }` para o request atual.
 *
 * Ordem de resolução do `adAccountId`:
 *  1. `opts.adAccountIdOverride` (vem do switcher na UI)
 *  2. `config.activeByUser[userId].adAccountId` (última seleção persistida)
 *  3. Primeira conta autorizada para o usuário (whitelist em `MemberMetaAccountAccess`)
 *  4. Fallback: `selectedAdAccountIds[0]` (legado — Owner/Admin sem whitelist)
 *
 * Em todos os casos valida que a conta resolvida ainda existe na config (ou seja,
 * não foi removida do OAuth) e que o usuário tem permissão (whitelist) para acessá-la.
 */
export async function getMetaAuth(
  orgId: string,
  opts?: { userId?: string; adAccountIdOverride?: string },
): Promise<MetaAuth | null> {
  const integration = await prisma.platformIntegration.findUnique({
    where: { organizationId_platform: { organizationId: orgId, platform: "META" } },
  });
  if (!integration || !integration.isActive) return null;

  const config = (integration.config ?? {}) as Record<string, unknown>;
  const accessToken = config.accessToken as string | undefined;
  if (!accessToken) return null;

  const userId = opts?.userId;

  // Whitelist do usuário (null = full access)
  const allowed = userId
    ? await getAuthorizedAccountKeys(orgId, userId, MetaAccountKind.AD_ACCOUNT)
    : null;

  const isAllowed = (id: string) => {
    if (allowed === null) return true;
    return allowed.map(normalizeAdAccountId).includes(normalizeAdAccountId(id));
  };

  // 1. Override explícito (validar permissão + existência)
  if (opts?.adAccountIdOverride) {
    const norm = normalizeAdAccountId(opts.adAccountIdOverride);
    if (isAllowed(norm) && isAdAccountInConfig(config, norm)) {
      return { accessToken, adAccountId: norm };
    }
  }

  // 2. Última seleção persistida pelo usuário
  if (userId) {
    const activeByUser = (config.activeByUser as Record<string, { adAccountId?: string }> | undefined) ?? {};
    const persisted = activeByUser[userId]?.adAccountId;
    if (persisted) {
      const norm = normalizeAdAccountId(persisted);
      if (isAllowed(norm) && isAdAccountInConfig(config, norm)) {
        return { accessToken, adAccountId: norm };
      }
    }
  }

  // 3. Primeira conta autorizada
  if (allowed && allowed.length > 0) {
    const list = (config.adAccounts as AdAccountEntry[] | undefined) ?? [];
    for (const acc of list) {
      const id = normalizeAdAccountId(acc.account_id ?? acc.id ?? "");
      if (id && isAllowed(id)) {
        return { accessToken, adAccountId: id };
      }
    }
  }

  // 4. Legado — primeira conta selecionada na config
  const fallback = pickAdAccountIdFromConfig(config) ?? (config.adAccountId as string | undefined);
  if (!fallback) return null;
  const fallbackNorm = normalizeAdAccountId(fallback);
  if (!isAllowed(fallbackNorm)) return null;
  return { accessToken, adAccountId: fallbackNorm };
}
