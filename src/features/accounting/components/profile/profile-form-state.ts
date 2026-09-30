import type { useAccountingProfile } from "@/features/accounting/hooks/use-accounting-profile";
import type { TaxRegimeDisplay } from "@/features/accounting/lib/profile/tax-display";
import { bpsToInputText, centsToInputText, parseBrlToCents, parsePercentToBps } from "@/features/accounting/lib/profile/parse-inputs";
import { onlyDigits } from "@/features/accounting/lib/profile/suggest-simples-annex";

export type AccountingProfileData = NonNullable<ReturnType<typeof useAccountingProfile>["data"]>;

export const DEFAULT_UF = "PI";
export const DEFAULT_MUNICIPIO_IBGE = "2211001";
export const DEFAULT_PRESUMED_BASE_BPS = 3200;

export const KNOWN_MUNICIPALITIES: Record<string, string> = {
  "2211001": "Teresina",
};

export const BRAZILIAN_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export interface ProfileFormState {
  regime: TaxRegimeDisplay;
  cnaePrincipal: string;
  cnaesSecundarios: string[];
  simplesAnnex: string;
  isFatorRSubject: boolean;
  uf: string;
  municipioIbge: string;
  stateRegistration: string;
  municipalRegistration: string;
  isIcmsContributor: boolean;
  isIssContributor: boolean;
  issRateText: string;
  openedAt: string;
  hasEmployees: boolean;
  payroll12mText: string;
  presumedIrpjBaseText: string;
  presumedCsllBaseText: string;
  ibsCbsOutsideSimples: boolean;
  alertPhones: string[];
}

export function toFormState(profile: AccountingProfileData): ProfileFormState {
  return {
    regime: profile.regime,
    cnaePrincipal: profile.cnaePrincipal ?? "",
    cnaesSecundarios: profile.cnaesSecundarios,
    simplesAnnex: profile.simplesAnnex ?? "",
    isFatorRSubject: profile.isFatorRSubject,
    uf: profile.uf ?? DEFAULT_UF,
    municipioIbge: profile.municipioIbge ?? DEFAULT_MUNICIPIO_IBGE,
    stateRegistration: profile.stateRegistration ?? "",
    municipalRegistration: profile.municipalRegistration ?? "",
    isIcmsContributor: profile.isIcmsContributor,
    isIssContributor: profile.isIssContributor,
    issRateText: bpsToInputText(profile.issRateBps),
    openedAt: profile.openedAt ? profile.openedAt.toISOString().slice(0, 10) : "",
    hasEmployees: profile.hasEmployees,
    payroll12mText: centsToInputText(profile.payroll12mCents),
    presumedIrpjBaseText: bpsToInputText(profile.presumedIrpjBaseBps || DEFAULT_PRESUMED_BASE_BPS),
    presumedCsllBaseText: bpsToInputText(profile.presumedCsllBaseBps || DEFAULT_PRESUMED_BASE_BPS),
    ibsCbsOutsideSimples: profile.ibsCbsOutsideSimples,
    alertPhones: profile.alertPhones,
  };
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function clampBps(bps: number | null, max: number): number | null {
  if (bps === null) return null;
  return Math.min(max, Math.max(0, bps));
}

/** Monta o input do `profile.update` a partir do formulário. */
export function toUpdatePayload(form: ProfileFormState) {
  const municipioDigits = onlyDigits(form.municipioIbge);
  const isSimplesLike = form.regime === "SIMPLES" || form.regime === "MEI";
  return {
    regime: form.regime,
    cnaePrincipal: textOrNull(onlyDigits(form.cnaePrincipal)),
    cnaesSecundarios: form.cnaesSecundarios.map(onlyDigits).filter(Boolean),
    simplesAnnex: isSimplesLike ? textOrNull(form.simplesAnnex) : null,
    isFatorRSubject: form.regime === "SIMPLES" ? form.isFatorRSubject : false,
    uf: form.uf.length === 2 ? form.uf : null,
    municipioIbge: municipioDigits.length === 7 ? municipioDigits : null,
    stateRegistration: textOrNull(form.stateRegistration),
    municipalRegistration: textOrNull(form.municipalRegistration),
    isIcmsContributor: form.isIcmsContributor,
    isIssContributor: form.isIssContributor,
    issRateBps: clampBps(parsePercentToBps(form.issRateText), 1000),
    openedAt: form.openedAt || null,
    hasEmployees: form.hasEmployees,
    payroll12mCents: parseBrlToCents(form.payroll12mText),
    presumedIrpjBaseBps: clampBps(parsePercentToBps(form.presumedIrpjBaseText), 10000) ?? DEFAULT_PRESUMED_BASE_BPS,
    presumedCsllBaseBps: clampBps(parsePercentToBps(form.presumedCsllBaseText), 10000) ?? DEFAULT_PRESUMED_BASE_BPS,
    ibsCbsOutsideSimples: form.regime === "SIMPLES" ? form.ibsCbsOutsideSimples : false,
    alertPhones: form.alertPhones,
  };
}
