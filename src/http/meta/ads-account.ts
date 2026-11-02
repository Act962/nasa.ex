/**
 * Leituras da conta e do token para o "Testar conexão" (spec 0122, RF-7).
 * Só leitura: nada aqui altera a conta de anúncios.
 */

import { actId } from "./ads-management";
import { MetaGraphError, metaGraphPaginate, metaGraphRequest, type MetaRequestAuth } from "./graph-client";

export interface MetaTokenOwner {
  id: string;
  name: string | null;
}

export async function getMetaTokenOwner(auth: MetaRequestAuth): Promise<MetaTokenOwner> {
  const owner = await metaGraphRequest<{ id: string; name?: string }>("me", {
    auth,
    query: { fields: "id,name" },
  });
  return { id: owner.id, name: owner.name ?? null };
}

/** Permissões concedidas ao token (`/me/permissions`). */
export async function getMetaGrantedPermissions(auth: MetaRequestAuth): Promise<string[]> {
  const { items } = await metaGraphPaginate<{ permission: string; status: string }>("me/permissions", {
    auth,
    maxPages: 2,
  });
  return items.filter((grant) => grant.status === "granted").map((grant) => grant.permission);
}

export interface MetaTokenDebugInfo {
  type: string | null;
  isValid: boolean;
  /** `null` = não expira. */
  expiresAt: Date | null;
  scopes: string[];
}

/**
 * `debug_token` com o token do app (`appId|appSecret`). O token inspecionado vai em
 * `input_token`, como a Meta exige nesse endpoint; o de acesso, no cabeçalho.
 */
export async function debugMetaToken(params: {
  accessToken: string;
  appId: string;
  appSecret: string;
}): Promise<MetaTokenDebugInfo> {
  const debugResult = await metaGraphRequest<{
    data?: { type?: string; is_valid?: boolean; expires_at?: number; scopes?: string[] };
  }>("debug_token", {
    auth: { accessToken: `${params.appId}|${params.appSecret}` },
    query: { input_token: params.accessToken },
  });
  const tokenData = debugResult.data ?? {};
  const expiresAtSeconds = Number(tokenData.expires_at ?? 0);
  return {
    type: tokenData.type ?? null,
    isValid: Boolean(tokenData.is_valid),
    expiresAt: expiresAtSeconds > 0 ? new Date(expiresAtSeconds * 1000) : null,
    scopes: tokenData.scopes ?? [],
  };
}

export interface MetaAdAccountInfo {
  id: string;
  accountId: string;
  name: string;
  /** 1 = ativa; 2 = desativada; 3 = pagamento pendente; 7/8/9 = em análise/fechamento/carência. */
  accountStatus: number;
  currency: string;
  timezoneName: string | null;
  minDailyBudgetCents: number | null;
  businessId: string | null;
  businessName: string | null;
}

export async function getAdAccountInfo(auth: MetaRequestAuth, adAccountId: string): Promise<MetaAdAccountInfo> {
  const account = await metaGraphRequest<{
    id: string;
    account_id: string;
    name: string;
    account_status: number;
    currency: string;
    timezone_name?: string;
    min_daily_budget?: number | string;
  }>(actId(adAccountId), {
    auth,
    query: { fields: "id,account_id,name,account_status,currency,timezone_name,min_daily_budget" },
  });
  const business = await readAdAccountBusiness(auth, adAccountId);
  const minDailyBudget = Number(account.min_daily_budget ?? NaN);
  return {
    id: account.id,
    accountId: account.account_id,
    name: account.name,
    accountStatus: Number(account.account_status),
    currency: account.currency,
    timezoneName: account.timezone_name ?? null,
    minDailyBudgetCents: Number.isFinite(minDailyBudget) ? minDailyBudget : null,
    businessId: business?.id ?? null,
    businessName: business?.name ?? null,
  };
}

/** O campo `business` exige `business_management`: sem ela, a conta é lida igual e o BM fica em branco. */
async function readAdAccountBusiness(
  auth: MetaRequestAuth,
  adAccountId: string,
): Promise<{ id: string; name?: string } | null> {
  try {
    const result = await metaGraphRequest<{ business?: { id: string; name?: string } }>(actId(adAccountId), {
      auth,
      query: { fields: "business{id,name}" },
    });
    return result.business ?? null;
  } catch (error) {
    // A Meta responde #100 "Requires business_management permission", fora da faixa de permissão (10, 2xx).
    if (error instanceof MetaGraphError && (error.kind === "permission" || error.code === 100)) return null;
    throw error;
  }
}

export interface MetaPromotablePage {
  id: string;
  name: string;
  instagramUserId: string | null;
  instagramUsername: string | null;
}

/** Páginas que podem anunciar por esta conta (`/act_{id}/promote_pages`). */
export async function listPromotablePages(auth: MetaRequestAuth, adAccountId: string): Promise<MetaPromotablePage[]> {
  const { items } = await metaGraphPaginate<{
    id: string;
    name: string;
    instagram_business_account?: { id?: string; username?: string };
  }>(`${actId(adAccountId)}/promote_pages`, {
    auth,
    maxPages: 2,
    query: { fields: "id,name,instagram_business_account{id,username}", limit: 50 },
  });
  return items.map((page) => ({
    id: page.id,
    name: page.name,
    instagramUserId: page.instagram_business_account?.id ?? null,
    instagramUsername: page.instagram_business_account?.username ?? null,
  }));
}

/** Número de WhatsApp ligado à página; `null` quando não há ou a Meta não deixa ler. */
export async function getPageWhatsappNumber(auth: MetaRequestAuth, pageId: string): Promise<string | null> {
  try {
    const page = await metaGraphRequest<{ whatsapp_number?: string }>(pageId, {
      auth,
      query: { fields: "whatsapp_number" },
    });
    return page.whatsapp_number?.trim() || null;
  } catch {
    return null;
  }
}
