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
  return { ...check, ...capabilities, isOk: capabilities.canRead && !check.errorKind };
}
