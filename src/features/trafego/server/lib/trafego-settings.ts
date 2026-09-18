import "server-only";
import prisma from "@/lib/prisma";
import {
  columnKeyForStatusId as columnKeyForStatusIdInMap,
  parseStatusColumnMap,
  type TrafegoColumnKey,
  type TrafegoStatusColumnMap,
} from "@/features/trafego/lib/kanban-columns";

/**
 * Leitura cacheada do singleton `TrafegoSettings`. O subscriber do kanban e as
 * transições de status leem isso em toda mudança de lead — 30 s de cache
 * (mesmo TTL do `resolveOutboundProvider`) evitam uma query por evento.
 * `updateTrafegoSettings` invalida ao salvar.
 */
export interface TrafegoOperationsSettings {
  agencyOrganizationId: string | null;
  operationsTrackingId: string | null;
  statusColumnMap: TrafegoStatusColumnMap;
  briefingFormId: string | null;
  salesTrackingId: string | null;
  supportWhatsapp: string | null;
  includedCreatives: number;
  extraCreativeBrlCents: number;
  partnerBusinessId: string | null;
  whatsappActivationTemplate: string | null;
  whatsappStatusTemplate: string | null;
  whatsappOtpTemplate: string | null;
  whatsappTemplateLanguage: string;
  pixKey: string | null;
  pixHolderName: string | null;
  pixBankName: string | null;
  pixExpiryMinutes: number;
  clientNotificationsEnabled: boolean;
  financeAccountId: string | null;
  financeRevenueCategoryId: string | null;
  financePassthroughCategoryId: string | null;
}

const EMPTY_SETTINGS: TrafegoOperationsSettings = {
  agencyOrganizationId: null,
  operationsTrackingId: null,
  statusColumnMap: {},
  briefingFormId: null,
  salesTrackingId: null,
  supportWhatsapp: null,
  includedCreatives: 3,
  extraCreativeBrlCents: 4000,
  partnerBusinessId: null,
  whatsappActivationTemplate: null,
  whatsappStatusTemplate: null,
  whatsappOtpTemplate: null,
  whatsappTemplateLanguage: "pt_BR",
  pixKey: null,
  pixHolderName: null,
  pixBankName: null,
  pixExpiryMinutes: 10,
  clientNotificationsEnabled: true,
  financeAccountId: null,
  financeRevenueCategoryId: null,
  financePassthroughCategoryId: null,
};

const TTL_MS = 30_000;

const globalForSettings = globalThis as unknown as {
  __trafegoSettingsCache?: {
    value: TrafegoOperationsSettings;
    expiresAt: number;
  } | null;
};

export async function loadTrafegoSettings(options?: {
  fresh?: boolean;
}): Promise<TrafegoOperationsSettings> {
  const cached = globalForSettings.__trafegoSettingsCache;
  if (!options?.fresh && cached && cached.expiresAt > Date.now())
    return cached.value;

  const row = await prisma.trafegoSettings.findUnique({
    where: { id: "singleton" },
  });
  const value: TrafegoOperationsSettings = row
    ? {
        agencyOrganizationId: row.agencyOrganizationId,
        operationsTrackingId: row.operationsTrackingId,
        statusColumnMap: parseStatusColumnMap(row.statusColumnMap),
        briefingFormId: row.briefingFormId,
        salesTrackingId: row.salesTrackingId,
        supportWhatsapp: row.supportWhatsapp,
        includedCreatives: row.includedCreatives,
        extraCreativeBrlCents: row.extraCreativeBrlCents,
        partnerBusinessId: row.partnerBusinessId,
        whatsappActivationTemplate: row.whatsappActivationTemplate,
        whatsappStatusTemplate: row.whatsappStatusTemplate,
        whatsappOtpTemplate: row.whatsappOtpTemplate,
        pixKey: row.pixKey,
        pixHolderName: row.pixHolderName,
        pixBankName: row.pixBankName,
        pixExpiryMinutes: row.pixExpiryMinutes,
        whatsappTemplateLanguage: row.whatsappTemplateLanguage,
        clientNotificationsEnabled: row.clientNotificationsEnabled,
        financeAccountId: row.financeAccountId,
        financeRevenueCategoryId: row.financeRevenueCategoryId,
        financePassthroughCategoryId: row.financePassthroughCategoryId,
      }
    : EMPTY_SETTINGS;

  globalForSettings.__trafegoSettingsCache = {
    value,
    expiresAt: Date.now() + TTL_MS,
  };
  return value;
}

export function invalidateTrafegoSettingsCache(): void {
  globalForSettings.__trafegoSettingsCache = null;
}

export function statusIdForColumnKey(
  settings: TrafegoOperationsSettings,
  key: TrafegoColumnKey,
): string | null {
  return settings.statusColumnMap[key] ?? null;
}

export function columnKeyForStatusId(
  settings: TrafegoOperationsSettings,
  statusId: string,
): TrafegoColumnKey | null {
  return columnKeyForStatusIdInMap(settings.statusColumnMap, statusId);
}
