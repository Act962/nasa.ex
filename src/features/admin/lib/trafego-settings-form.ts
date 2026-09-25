/**
 * Estado do formulário de ajustes do trafeGO, separado da UI.
 *
 * Tudo vive como string porque os campos são inputs controlados; a conversão
 * para o contrato da procedure acontece num lugar só (`trafegoFormToUpdateInput`).
 */

import type { InferRouterInputs, InferRouterOutputs } from "@orpc/server";
import type { router } from "@/app/router";

type SettingsRouter = typeof router.trafego.admin.settings;

export type TrafegoSettingsPayload = InferRouterOutputs<SettingsRouter>["get"];
export type TrafegoSettingsUpdateInput =
  InferRouterInputs<SettingsRouter>["update"];

export interface TrafegoSettingsFormState {
  agencyOrganizationId: string;
  supportWhatsapp: string;
  partnerBusinessId: string;
  captureOrganizationId: string;
  captureTrackingId: string;
  captureStatusId: string;
  operationsTrackingId: string;
  statusColumnMap: Record<string, string>;
  briefingFormId: string;
  defaultServiceFeePercent: string;
  includedCreatives: string;
  extraCreativeBrl: string;
  pixKey: string;
  pixHolderName: string;
  pixBankName: string;
  pixExpiryMinutes: string;
  financeAccountId: string;
  financeRevenueCategoryId: string;
  financePassthroughCategoryId: string;
  clientNotificationsEnabled: boolean;
  whatsappActivationTemplate: string;
  whatsappStatusTemplate: string;
  whatsappOtpTemplate: string;
  whatsappTemplateLanguage: string;
  salesTrackingId: string;
  salesStatusId: string;
  defaultBroadcastTrackingId: string;
}

export type TrafegoSettingsPatch = (
  partial: Partial<TrafegoSettingsFormState>,
) => void;

export const EMPTY_TRAFEGO_SETTINGS_FORM: TrafegoSettingsFormState = {
  agencyOrganizationId: "",
  supportWhatsapp: "",
  partnerBusinessId: "",
  captureOrganizationId: "",
  captureTrackingId: "",
  captureStatusId: "",
  operationsTrackingId: "",
  statusColumnMap: {},
  briefingFormId: "",
  defaultServiceFeePercent: "50",
  includedCreatives: "3",
  extraCreativeBrl: "40.00",
  pixKey: "",
  pixHolderName: "",
  pixBankName: "",
  pixExpiryMinutes: "10",
  financeAccountId: "",
  financeRevenueCategoryId: "",
  financePassthroughCategoryId: "",
  clientNotificationsEnabled: true,
  whatsappActivationTemplate: "",
  whatsappStatusTemplate: "",
  whatsappOtpTemplate: "",
  whatsappTemplateLanguage: "pt_BR",
  salesTrackingId: "",
  salesStatusId: "",
  defaultBroadcastTrackingId: "",
};

export function trafegoSettingsToForm(
  settings: TrafegoSettingsPayload,
): TrafegoSettingsFormState {
  return {
    agencyOrganizationId: settings.agencyOrganizationId ?? "",
    supportWhatsapp: settings.supportWhatsapp ?? "",
    partnerBusinessId: settings.partnerBusinessId ?? "",
    captureOrganizationId: settings.captureOrganizationId ?? "",
    captureTrackingId: settings.captureTrackingId ?? "",
    captureStatusId: settings.captureStatusId ?? "",
    operationsTrackingId: settings.operationsTrackingId ?? "",
    statusColumnMap: (settings.statusColumnMap ?? {}) as Record<string, string>,
    briefingFormId: settings.briefingFormId ?? "",
    defaultServiceFeePercent: String(settings.defaultServiceFeePercent ?? 50),
    includedCreatives: String(settings.includedCreatives ?? 3),
    extraCreativeBrl: centsToBrlInput(settings.extraCreativeBrlCents ?? 4000),
    pixKey: settings.pixKey ?? "",
    pixHolderName: settings.pixHolderName ?? "",
    pixBankName: settings.pixBankName ?? "",
    pixExpiryMinutes: String(settings.pixExpiryMinutes ?? 10),
    financeAccountId: settings.financeAccountId ?? "",
    financeRevenueCategoryId: settings.financeRevenueCategoryId ?? "",
    financePassthroughCategoryId: settings.financePassthroughCategoryId ?? "",
    clientNotificationsEnabled: settings.clientNotificationsEnabled ?? true,
    whatsappActivationTemplate: settings.whatsappActivationTemplate ?? "",
    whatsappStatusTemplate: settings.whatsappStatusTemplate ?? "",
    whatsappOtpTemplate: settings.whatsappOtpTemplate ?? "",
    whatsappTemplateLanguage: settings.whatsappTemplateLanguage ?? "pt_BR",
    salesTrackingId: settings.salesTrackingId ?? "",
    salesStatusId: settings.salesStatusId ?? "",
    defaultBroadcastTrackingId: settings.defaultBroadcastTrackingId ?? "",
  };
}

export function trafegoFormToUpdateInput(
  form: TrafegoSettingsFormState,
): TrafegoSettingsUpdateInput {
  const emptyToNull = (value: string) => (value.trim() ? value.trim() : null);

  return {
    agencyOrganizationId: emptyToNull(form.agencyOrganizationId),
    supportWhatsapp: emptyToNull(form.supportWhatsapp),
    partnerBusinessId: emptyToNull(form.partnerBusinessId),
    captureOrganizationId: emptyToNull(form.captureOrganizationId),
    captureTrackingId: emptyToNull(form.captureTrackingId),
    captureStatusId: emptyToNull(form.captureStatusId),
    operationsTrackingId: emptyToNull(form.operationsTrackingId),
    statusColumnMap: form.statusColumnMap,
    briefingFormId: emptyToNull(form.briefingFormId),
    // A taxa aceita fração (47,5%); as demais são inteiras no contrato.
    defaultServiceFeePercent: clampNumber(form.defaultServiceFeePercent, {
      fallback: 50,
      min: 0,
      max: 1000,
    }),
    includedCreatives: clampInteger(form.includedCreatives, {
      fallback: 3,
      min: 1,
      max: 20,
    }),
    extraCreativeBrlCents: clampInteger(brlInputToCents(form.extraCreativeBrl), {
      fallback: 0,
      min: 0,
      max: 1_000_000,
    }),
    pixKey: emptyToNull(form.pixKey),
    pixHolderName: emptyToNull(form.pixHolderName),
    pixBankName: emptyToNull(form.pixBankName),
    pixExpiryMinutes: clampInteger(form.pixExpiryMinutes, {
      fallback: 10,
      min: 1,
      max: 43_200,
    }),
    financeAccountId: emptyToNull(form.financeAccountId),
    financeRevenueCategoryId: emptyToNull(form.financeRevenueCategoryId),
    financePassthroughCategoryId: emptyToNull(form.financePassthroughCategoryId),
    clientNotificationsEnabled: form.clientNotificationsEnabled,
    whatsappActivationTemplate: emptyToNull(form.whatsappActivationTemplate),
    whatsappStatusTemplate: emptyToNull(form.whatsappStatusTemplate),
    whatsappOtpTemplate: emptyToNull(form.whatsappOtpTemplate),
    whatsappTemplateLanguage:
      form.whatsappTemplateLanguage.trim() || "pt_BR",
    salesTrackingId: emptyToNull(form.salesTrackingId),
    salesStatusId: emptyToNull(form.salesStatusId),
    defaultBroadcastTrackingId: emptyToNull(form.defaultBroadcastTrackingId),
  };
}

/** Campos alterados entre dois estados — alimenta o marcador por seção. */
export function changedTrafegoSettingsFields(
  current: TrafegoSettingsFormState,
  baseline: TrafegoSettingsFormState,
): Set<keyof TrafegoSettingsFormState> {
  const changed = new Set<keyof TrafegoSettingsFormState>();

  for (const key of Object.keys(current) as (keyof TrafegoSettingsFormState)[]) {
    if (key === "statusColumnMap") {
      const isSameMap =
        serializeStatusColumnMap(current.statusColumnMap) ===
        serializeStatusColumnMap(baseline.statusColumnMap);
      if (!isSameMap) changed.add(key);
      continue;
    }
    if (current[key] !== baseline[key]) changed.add(key);
  }

  return changed;
}

function serializeStatusColumnMap(map: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(map)
      .filter(([, statusId]) => Boolean(statusId))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function centsToBrlInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function brlInputToCents(value: string): string {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? String(Math.round(parsed * 100)) : "";
}

interface ClampRange {
  fallback: number;
  min: number;
  max: number;
}

function clampNumber(value: string, { fallback, min, max }: ClampRange): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampInteger(value: string, range: ClampRange): number {
  return Math.round(clampNumber(value, range));
}
