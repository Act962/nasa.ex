// Preflight + payload de emissão de NFS-e via NFE.io (ServiceInvoice).
// Atenção de escala: a NFE.io espera issRate como FRAÇÃO (0.05 = 5%), enquanto
// profile.defaultAliquotaIss é PERCENTUAL (5 = 5%, mesma escala usada pelo Focus
// e pelo display) — por isso dividimos por 100 aqui. E cityServiceCode é o código
// do serviço no formato do MUNICÍPIO (≠ item LC116 do fluxo Focus).

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { FiscalCompanyProfile } from "@/generated/prisma/client";
import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { resolveMunicipioRequirements } from "../../../municipio-requirements";
import type {
  FiscalIssueOverrides,
  FiscalIssueSource,
  PreflightResult,
} from "../../types";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Sao_Paulo";

// defaultAliquotaIss é percentual (5 = 5%); a NFE.io quer fração (0.05). Aceita
// Decimal (profile) ou number (draft de sincronização), ambos via Number().
export function percentToFraction(
  aliquotaPercent: number | string | { toString(): string },
): number {
  return Number(aliquotaPercent) / 100;
}

export function resolveCityServiceCode(
  profile: FiscalCompanyProfile,
  overrides: FiscalIssueOverrides,
): string | null {
  return (
    overrides.cityServiceCode?.trim() ||
    profile.defaultCityServiceCode?.trim() ||
    null
  );
}

// Resolve um valor monetário a partir de um percentual (override por nota ou
// padrão do perfil) aplicado sobre o valor do serviço. Retorna undefined quando
// o percentual é zero/ausente — a NFE.io não deve receber o campo nesse caso.
function resolvePercentAmount(
  servicesAmount: number,
  overridePercent: number | undefined,
  profilePercent: { toString(): string } | number | null | undefined,
): number | undefined {
  const percent = overridePercent ?? Number(profilePercent ?? 0);
  if (!Number.isFinite(percent) || percent <= 0) return undefined;
  return Number((servicesAmount * (percent / 100)).toFixed(2));
}

export function validateBeforeEmitNfeIo(
  source: FiscalIssueSource,
  profile: FiscalCompanyProfile,
  overrides: FiscalIssueOverrides,
  environment: FiscalEnvironment,
): PreflightResult {
  const errors: string[] = [];
  const requirements = resolveMunicipioRequirements(profile.codigoMunicipio);

  if (!profile.nfeIoCompanyId)
    errors.push(
      "Empresa não está cadastrada na NFE.io. Salve o perfil fiscal novamente.",
    );
  // O ambiente é uma propriedade da EMPRESA cadastrada na NFE.io (enviado em
  // sync-company.ts ao criar/atualizar o Company resource), não um parâmetro
  // da chamada de emissão — uma nota pedida num ambiente diferente do
  // cadastrado seria processada no ambiente da empresa mesmo assim,
  // divergindo silenciosamente do que foi solicitado/exibido.
  if (environment !== profile.environment)
    errors.push(
      `O ambiente da emissão (${environment}) difere do ambiente da empresa na NFE.io (${profile.environment}). Ajuste o perfil fiscal.`,
    );
  if (!resolveCityServiceCode(profile, overrides))
    errors.push(
      "Código de serviço municipal (cityServiceCode) não configurado. Defina no perfil fiscal ou informe na emissão.",
    );
  if (
    requirements.requiresInscricaoMunicipalPrestador &&
    !profile.inscricaoMunicipal
  )
    errors.push("Inscrição municipal do prestador não configurada.");
  if (Number(profile.defaultAliquotaIss) <= 0)
    errors.push("Alíquota ISS inválida.");
  if (source.amount <= 0)
    errors.push("Valor do serviço deve ser maior que zero.");

  if (overrides.tipoTomador === "PJ") {
    const cnpj = (overrides.tomadorCnpj ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) errors.push("CNPJ do tomador inválido.");
    if (!overrides.tomadorRazaoSocial)
      errors.push("Razão social do tomador obrigatória para PJ.");
  } else {
    const cpf = (overrides.tomadorCpf ?? "").replace(/\D/g, "");
    if (cpf.length !== 11) errors.push("CPF do tomador inválido.");
    if (!overrides.tomadorNome)
      errors.push("Nome do tomador obrigatório para PF.");
  }

  // A NFE.io exige a cidade do tomador (borrower.address.city) em toda emissão,
  // independente do que o município do prestador exige — sem ela, retorna 400.
  if (!overrides.tomadorCodigoMunicipio?.trim())
    errors.push(
      "Município do tomador obrigatório (a NFE.io exige a cidade do tomador na nota).",
    );

  if (requirements.requiresTomadorEndereco) {
    if (!overrides.tomadorLogradouro)
      errors.push("Logradouro do tomador obrigatório.");
    if (!overrides.tomadorNumero)
      errors.push("Número do endereço do tomador obrigatório.");
    if (!overrides.tomadorBairro) errors.push("Bairro do tomador obrigatório.");
    const tomadorCepDigits = (overrides.tomadorCep ?? "").replace(/\D/g, "");
    if (tomadorCepDigits.length !== 8)
      errors.push("CEP do tomador obrigatório (deve ter 8 dígitos).");
    if (!overrides.tomadorUf) errors.push("UF do tomador obrigatória.");
  }

  return { valid: errors.length === 0, errors };
}

type NfeIoBorrowerAddress = {
  country: string;
  postalCode?: string;
  street?: string;
  number?: string;
  additionalInformation?: string;
  district?: string;
  city?: { code: string; name?: string };
  state?: string;
};

export type NfeIoServiceInvoicePayload = {
  externalId: string;
  cityServiceCode: string;
  // Item da lista de serviço LC 116 — a NFE.io usa para achar a alíquota IBPT
  // (carga tributária aproximada) por estado; sem ele a nota falha o cálculo
  // com "ibpt code '' was not found for state 'XX'". Formato confirmado em
  // produção: 6 dígitos de profile.defaultItemListaServico (item+subitem+
  // desdobro nacional), enviados sem pontuação. Ex.: "170601".
  federalServiceCode?: string;
  cnaeCode?: string;
  description: string;
  servicesAmount: number;
  issRate: number;
  issuedOn: string;
  taxationType?: string;
  issAmountWithheld?: number;
  irAmountWithheld?: number;
  pisAmountWithheld?: number;
  cofinsAmountWithheld?: number;
  csllAmountWithheld?: number;
  inssAmountWithheld?: number;
  othersAmountWithheld?: number;
  deductionsAmount?: number;
  discountUnconditionedAmount?: number;
  discountConditionedAmount?: number;
  additionalInformation?: string;
  borrower: {
    type: "NaturalPerson" | "LegalEntity";
    name: string;
    federalTaxNumber: number;
    municipalTaxNumber?: string;
    email?: string;
    address?: NfeIoBorrowerAddress;
  };
};

export function buildNfeIoServiceInvoicePayload(
  ref: string,
  source: FiscalIssueSource,
  profile: FiscalCompanyProfile,
  overrides: FiscalIssueOverrides,
): NfeIoServiceInvoicePayload {
  const isPj = overrides.tipoTomador === "PJ";
  const documentoDigits = (
    (isPj ? overrides.tomadorCnpj : overrides.tomadorCpf) ?? ""
  ).replace(/\D/g, "");

  // A NFE.io exige a cidade do tomador (borrower.address.city). Montamos o
  // endereço sempre que houver o código do município; os demais campos entram
  // só quando existirem (filosofia superset — prefeituras ignoram o que não
  // usam, e um lookup de CNPJ incompleto não deve suprimir a cidade inteira).
  const tomadorCodigoMunicipio = overrides.tomadorCodigoMunicipio?.trim();
  const tomadorCepDigits = (overrides.tomadorCep ?? "").replace(/\D/g, "");
  const borrowerAddress: NfeIoBorrowerAddress | undefined =
    tomadorCodigoMunicipio
      ? {
          country: "BRA",
          // A NFE.io exige o NOME do município do tomador além do código — só o
          // code retorna "city.code or name can not be null or empty".
          city: {
            code: tomadorCodigoMunicipio,
            ...(overrides.tomadorMunicipio?.trim()
              ? { name: overrides.tomadorMunicipio.trim() }
              : {}),
          },
          ...(overrides.tomadorUf ? { state: overrides.tomadorUf } : {}),
          ...(tomadorCepDigits ? { postalCode: tomadorCepDigits } : {}),
          ...(overrides.tomadorLogradouro
            ? { street: overrides.tomadorLogradouro }
            : {}),
          ...(overrides.tomadorNumero
            ? { number: overrides.tomadorNumero }
            : {}),
          ...(overrides.tomadorComplemento?.trim()
            ? { additionalInformation: overrides.tomadorComplemento.trim() }
            : {}),
          ...(overrides.tomadorBairro
            ? { district: overrides.tomadorBairro }
            : {}),
        }
      : undefined;

  const servicesAmount = source.amount;
  const issRate = percentToFraction(profile.defaultAliquotaIss);

  // ISS retido: override por nota tem prioridade sobre o boolean do perfil; o
  // valor sai da alíquota configurada (decisão de produto: derivar, não digitar).
  const issRetido = overrides.issRetido ?? profile.defaultIssRetido;

  const irAmountWithheld = resolvePercentAmount(
    servicesAmount,
    overrides.irPercent,
    profile.defaultIrPercent,
  );
  const pisAmountWithheld = resolvePercentAmount(
    servicesAmount,
    overrides.pisPercent,
    profile.defaultPisPercent,
  );
  const cofinsAmountWithheld = resolvePercentAmount(
    servicesAmount,
    overrides.cofinsPercent,
    profile.defaultCofinsPercent,
  );
  const csllAmountWithheld = resolvePercentAmount(
    servicesAmount,
    overrides.csllPercent,
    profile.defaultCsllPercent,
  );
  const inssAmountWithheld = resolvePercentAmount(
    servicesAmount,
    overrides.inssPercent,
    profile.defaultInssPercent,
  );
  const othersAmountWithheld = resolvePercentAmount(
    servicesAmount,
    overrides.outrasRetencoesPercent,
    profile.defaultOutrasRetencoesPercent,
  );
  const deductionsAmount = resolvePercentAmount(
    servicesAmount,
    overrides.deducoesPercent,
    profile.defaultDeducoesPercent,
  );
  const discountUnconditionedAmount = resolvePercentAmount(
    servicesAmount,
    overrides.descontoIncondicionadoPercent,
    profile.defaultDescontoIncondicionadoPercent,
  );
  const discountConditionedAmount = resolvePercentAmount(
    servicesAmount,
    overrides.descontoCondicionadoPercent,
    profile.defaultDescontoCondicionadoPercent,
  );

  const additionalInformation =
    overrides.informacoesAdicionais?.trim() ||
    profile.defaultInformacoesAdicionais?.trim() ||
    undefined;

  const tomadorInscricaoMunicipal = overrides.tomadorInscricaoMunicipal?.trim();

  return {
    externalId: ref,
    cityServiceCode: resolveCityServiceCode(profile, overrides)!,
    ...(profile.defaultItemListaServico
      ? { federalServiceCode: profile.defaultItemListaServico }
      : {}),
    ...(profile.defaultCodigoCnae
      ? { cnaeCode: profile.defaultCodigoCnae }
      : {}),
    description:
      overrides.discriminacao?.trim() ||
      profile.defaultDiscriminacao?.trim() ||
      source.defaultDescription,
    servicesAmount,
    issRate,
    issuedOn: dayjs(overrides.dataCompetencia).tz(TIMEZONE).format(),
    ...(overrides.taxationType ? { taxationType: overrides.taxationType } : {}),
    ...(issRetido
      ? { issAmountWithheld: Number((servicesAmount * issRate).toFixed(2)) }
      : {}),
    ...(irAmountWithheld ? { irAmountWithheld } : {}),
    ...(pisAmountWithheld ? { pisAmountWithheld } : {}),
    ...(cofinsAmountWithheld ? { cofinsAmountWithheld } : {}),
    ...(csllAmountWithheld ? { csllAmountWithheld } : {}),
    ...(inssAmountWithheld ? { inssAmountWithheld } : {}),
    ...(othersAmountWithheld ? { othersAmountWithheld } : {}),
    ...(deductionsAmount ? { deductionsAmount } : {}),
    ...(discountUnconditionedAmount ? { discountUnconditionedAmount } : {}),
    ...(discountConditionedAmount ? { discountConditionedAmount } : {}),
    ...(additionalInformation ? { additionalInformation } : {}),
    borrower: {
      type: isPj ? "LegalEntity" : "NaturalPerson",
      name: (isPj ? overrides.tomadorRazaoSocial : overrides.tomadorNome) ?? "",
      federalTaxNumber: Number(documentoDigits),
      ...(tomadorInscricaoMunicipal
        ? { municipalTaxNumber: tomadorInscricaoMunicipal }
        : {}),
      ...(overrides.tomadorEmail?.trim()
        ? { email: overrides.tomadorEmail.trim() }
        : {}),
      ...(borrowerAddress ? { address: borrowerAddress } : {}),
    },
  };
}
