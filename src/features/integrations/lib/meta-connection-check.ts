import "server-only";

import {
  debugMetaToken,
  getAdAccountInfo,
  getMetaGrantedPermissions,
  getMetaTokenOwner,
  getPageWhatsappNumber,
  listPromotablePages,
} from "@/http/meta/ads-account";
import { MetaGraphError, type MetaGraphErrorKind } from "@/http/meta/graph-client";
import { connectAdsMcp } from "@/http/meta/ads-mcp-client";
import { readMetaAccessToken, readMetaAppSecret } from "./integration-api-key";

/** "Testar conexão" da Meta (spec 0122, RF-7..RF-9): resumo sem nenhum segredo, gravado em `config.connectionCheck`. */

export const META_PERMISSIONS_FOR_CREATE = [
  "ads_management",
  "pages_manage_ads",
  "pages_read_engagement",
  "pages_show_list",
] as const;

const META_ACCOUNT_STATUS_LABELS: Record<number, string> = {
  1: "Ativa",
  2: "Desativada",
  3: "Pagamento pendente",
  7: "Em análise de risco",
  8: "Pagamento em acerto",
  9: "Em período de carência",
  100: "Fechamento pendente",
  101: "Fechada",
};

const MAX_PAGES_WITH_WHATSAPP_CHECK = 3;

export function describeMetaAccountStatus(accountStatus: number): string {
  return META_ACCOUNT_STATUS_LABELS[accountStatus] ?? `Status ${accountStatus}`;
}

export interface MetaConnectionCheck {
  checkedAt: string;
  isOk: boolean;
  errorKind: MetaGraphErrorKind | "missing_token" | "missing_account" | null;
  errorMessage: string | null;
  tokenOwner: { id: string; name: string | null } | null;
  tokenType: string | null;
  /** `null` com `neverExpires=true` = usuário do sistema sem validade; ambos `null` = não verificado. */
  expiresAt: string | null;
  neverExpires: boolean | null;
  grantedPermissions: string[] | null;
  missingForRead: string[];
  missingForCreate: string[];
  account: {
    id: string;
    name: string;
    accountStatus: number;
    statusLabel: string;
    currency: string;
    timezoneName: string | null;
    minDailyBudgetCents: number | null;
    businessName: string | null;
  } | null;
  pages: {
    id: string;
    name: string;
    instagramUserId?: string | null;
    instagramUsername: string | null;
    whatsappNumber: string | null;
  }[];
  canRead: boolean;
  canCreate: boolean;
  /** Spec 0125: o Astro pode gerenciar a conta pelo MCP oficial da Meta. */
  canUseAstro?: boolean;
  astroBlockedReason?: string | null;
}

/** Regra pura do Astro (spec 0125, RF-8): permissão + conta liberada pela Meta. */
export function evaluateAstroAvailability(params: {
  grantedPermissions: string[] | null;
  canRead: boolean;
  isAccountMcpEnabled: boolean | null;
}): { canUseAstro: boolean; astroBlockedReason: string | null } {
  if (!params.canRead) return { canUseAstro: false, astroBlockedReason: "A conexão ainda não lê a conta de anúncios." };
  if (params.grantedPermissions && !params.grantedPermissions.includes("ads_mcp_management")) {
    return {
      canUseAstro: false,
      astroBlockedReason:
        "Falta a permissão ads_mcp_management no token. O app da Meta precisa do caso de uso \"Crie e gerencie anúncios com o servidor MCP de anúncios\".",
    };
  }
  if (params.isAccountMcpEnabled === false) {
    return { canUseAstro: false, astroBlockedReason: "A Meta ainda não liberou o Astro (MCP de anúncios) para esta conta. A liberação é gradual." };
  }
  if (params.isAccountMcpEnabled === null) {
    return { canUseAstro: false, astroBlockedReason: "Não foi possível confirmar com a Meta se o Astro está liberado para esta conta." };
  }
  return { canUseAstro: true, astroBlockedReason: null };
}

/** Regra pura de capacidade, separada para o script de QA. */
export function evaluateMetaCapabilities(params: {
  grantedPermissions: string[] | null;
  accountStatus: number | null;
  promotablePagesCount: number;
}): Pick<MetaConnectionCheck, "canRead" | "canCreate" | "missingForRead" | "missingForCreate"> {
  const granted = new Set(params.grantedPermissions ?? []);
  const isPermissionListKnown = params.grantedPermissions !== null;
  const hasReadPermission = granted.has("ads_read") || granted.has("ads_management");
  const missingForRead = isPermissionListKnown && !hasReadPermission ? ["ads_read"] : [];
  const missingForCreate = isPermissionListKnown
    ? META_PERMISSIONS_FOR_CREATE.filter((permission) => !granted.has(permission))
    : [];
  const isAccountReadable = params.accountStatus !== null;
  return {
    canRead: isAccountReadable && missingForRead.length === 0,
    canCreate:
      isPermissionListKnown &&
      missingForCreate.length === 0 &&
      params.accountStatus === 1 &&
      params.promotablePagesCount > 0,
    missingForRead,
    missingForCreate,
  };
}

function toCheckError(error: unknown): { kind: MetaGraphErrorKind; message: string } {
  if (error instanceof MetaGraphError) return { kind: error.kind, message: error.userMessage };
  return { kind: "unknown", message: "Não foi possível falar com a Meta agora." };
}

/** A Meta diz, conta por conta, se o MCP de anúncios está liberado (`is_ads_mcp_enabled`). */
async function readAccountMcpEnabled(accessToken: string, adAccountId: string): Promise<boolean | null> {
  const accountNumber = adAccountId.replace(/^act_/, "");
  try {
    const connection = await connectAdsMcp(accessToken);
    try {
      let cursor: string | undefined;
      for (let page = 0; page < 4; page++) {
        const result = (await connection.callTool("ads_get_ad_accounts", {
          limit: 50,
          client_conversation_id: "orbitaConnCheck00000",
          ...(cursor ? { cursor } : {}),
        })) as { ad_accounts?: { ad_account_id?: string; is_ads_mcp_enabled?: boolean }[]; next_cursor?: string | null } | null;
        const account = result?.ad_accounts?.find((item) => String(item.ad_account_id) === accountNumber);
        if (account) return account.is_ads_mcp_enabled === true;
        cursor = result?.next_cursor ?? undefined;
        if (!cursor) break;
      }
      return false;
    } finally {
      await connection.close();
    }
  } catch {
    return null;
  }
}

export async function runMetaConnectionCheck(config: Record<string, unknown> | null): Promise<MetaConnectionCheck> {
  const checkedAt = new Date().toISOString();
  const emptyCheck: MetaConnectionCheck = {
    checkedAt,
    isOk: false,
    errorKind: null,
    errorMessage: null,
    tokenOwner: null,
    tokenType: null,
    expiresAt: null,
    neverExpires: null,
    grantedPermissions: null,
    missingForRead: [],
    missingForCreate: [],
    account: null,
    pages: [],
    canRead: false,
    canCreate: false,
  };

  const accessToken = readMetaAccessToken(config);
  if (!accessToken) {
    return { ...emptyCheck, errorKind: "missing_token", errorMessage: "Cole o token de acesso da Meta." };
  }
  const appSecret = readMetaAppSecret(config);
  const appId = typeof config?.appId === "string" ? config.appId.trim() : "";
  const adAccountId = typeof config?.adAccountId === "string" ? config.adAccountId.trim() : "";
  const auth = { accessToken, appSecret };

  const check: MetaConnectionCheck = { ...emptyCheck };

  try {
    check.tokenOwner = await getMetaTokenOwner(auth);
  } catch (ownerError) {
    const { kind, message } = toCheckError(ownerError);
    return { ...check, errorKind: kind, errorMessage: message };
  }

  if (appId && appSecret) {
    try {
      const debugInfo = await debugMetaToken({ accessToken, appId, appSecret });
      check.tokenType = debugInfo.type;
      check.expiresAt = debugInfo.expiresAt?.toISOString() ?? null;
      check.neverExpires = debugInfo.expiresAt === null;
      check.grantedPermissions = debugInfo.scopes;
    } catch {
      // Sem `debug_token` (app de outro dono, segredo errado): a validade fica "não verificada".
    }
  }
  if (!check.grantedPermissions) {
    try {
      check.grantedPermissions = await getMetaGrantedPermissions(auth);
    } catch {
      check.grantedPermissions = null;
    }
  }

  if (!adAccountId) {
    check.errorKind = "missing_account";
    check.errorMessage = "Informe o ID da conta de anúncios (act_…).";
  } else {
    try {
      const accountInfo = await getAdAccountInfo(auth, adAccountId);
      check.account = {
        id: accountInfo.id,
        name: accountInfo.name,
        accountStatus: accountInfo.accountStatus,
        statusLabel: describeMetaAccountStatus(accountInfo.accountStatus),
        currency: accountInfo.currency,
        timezoneName: accountInfo.timezoneName,
        minDailyBudgetCents: accountInfo.minDailyBudgetCents,
        businessName: accountInfo.businessName,
      };
    } catch (accountError) {
      const { kind, message } = toCheckError(accountError);
      check.errorKind = kind;
      check.errorMessage =
        kind === "permission" ? "O token não tem acesso a esta conta de anúncios. Confira a atribuição no BM." : message;
    }
  }

  if (check.account) {
    try {
      const pages = await listPromotablePages(auth, adAccountId);
      check.pages = await Promise.all(
        pages.map(async (page, index) => ({
          ...page,
          whatsappNumber: index < MAX_PAGES_WITH_WHATSAPP_CHECK ? await getPageWhatsappNumber(auth, page.id) : null,
        })),
      );
    } catch {
      check.pages = [];
    }
  }

  const capabilities = evaluateMetaCapabilities({
    grantedPermissions: check.grantedPermissions,
    accountStatus: check.account?.accountStatus ?? null,
    promotablePagesCount: check.pages.length,
  });
  const astro = evaluateAstroAvailability({
    grantedPermissions: check.grantedPermissions,
    canRead: capabilities.canRead,
    isAccountMcpEnabled:
      capabilities.canRead && check.grantedPermissions?.includes("ads_mcp_management") !== false
        ? await readAccountMcpEnabled(accessToken, adAccountId)
        : null,
  });
  return { ...check, ...capabilities, ...astro, isOk: capabilities.canRead && !check.errorKind };
}
