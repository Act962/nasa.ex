import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type {
  FiscalCompanyProfile,
  TomadorType,
} from "@/generated/prisma/client";
import type { FiscalEnvironment } from "@/generated/prisma/enums";
import type { MunicipioNfseRequirements } from "@/features/fiscal/lib/municipio-requirements";
import type { NfseEndereco, NfsePayload } from "./types";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Sao_Paulo";

// Fonte genérica de emissão — desacopla os gateways/builders de qual entidade
// de domínio originou a nota (ForgeContract, PaymentEntry, ...).
export type FiscalIssueSource = {
  amount: number; // valor do serviço em REAIS (não centavos)
  defaultDescription: string; // fallback da discriminação quando não informada
};

export type IssueOverrides = {
  tipoTomador: TomadorType;
  discriminacao?: string;
  dataCompetencia: Date;
  naturezaOperacao?: string;
  regimeEspecialTributacao?: number;
  // Reforma Tributária (IBS/CBS) — override por nota; ausência = usa padrão do perfil.
  ibsCbsSituacaoTributaria?: string;
  ibsCbsClassificacaoTributaria?: string;
  consumidorFinal?: boolean;
  // Overrides financeiros por nota — percentuais (0–100) sobre o valor do serviço;
  // ausência = usa o padrão do perfil. issRetido sobrescreve o boolean do perfil.
  issRetido?: boolean;
  irPercent?: number;
  pisPercent?: number;
  cofinsPercent?: number;
  csllPercent?: number;
  inssPercent?: number;
  outrasRetencoesPercent?: number;
  deducoesPercent?: number;
  descontoIncondicionadoPercent?: number;
  descontoCondicionadoPercent?: number;
  informacoesAdicionais?: string;
  tomadorInscricaoMunicipal?: string;
  tomadorCnpj?: string;
  tomadorCpf?: string;
  tomadorRazaoSocial?: string;
  tomadorNome?: string;
  tomadorEmail?: string;
  tomadorLogradouro?: string;
  tomadorNumero?: string;
  tomadorComplemento?: string;
  tomadorBairro?: string;
  tomadorCodigoMunicipio?: string;
  tomadorMunicipio?: string;
  tomadorUf?: string;
  tomadorCep?: string;
};

export type PreflightResult = {
  valid: boolean;
  errors: string[];
};

export function validateBeforeEmit(
  source: FiscalIssueSource,
  profile: FiscalCompanyProfile,
  overrides: IssueOverrides,
  requirements: MunicipioNfseRequirements,
  environment: FiscalEnvironment,
): PreflightResult {
  const errors: string[] = [];

  // supportedByFocus é resolvido contra a lista de municípios da Focus em
  // PRODUCAO (profile-upsert.ts) — municípios com homologação disponível mas
  // sem portal de acesso (ex.: Teresina-PI) podem não refletir isso ali, então
  // o registry dispensa a checagem quando emitindo em homologação.
  const skipsSupportedByFocusCheck =
    environment === "HOMOLOGACAO" &&
    requirements.skipsSupportedByFocusInHomologacao;
  if (!profile.supportedByFocus && !skipsSupportedByFocusCheck)
    errors.push("Município do prestador não está integrado na Focus NFe.");
  if (!profile.focusEmpresaRegistered)
    errors.push("Empresa não está cadastrada na Focus NFe.");
  if (
    requirements.requiresInscricaoMunicipalPrestador &&
    !profile.inscricaoMunicipal
  )
    errors.push("Inscrição municipal do prestador não configurada.");
  if (!/^\d{7}$/.test(profile.codigoMunicipio))
    errors.push("Código IBGE do município inválido (deve ter 7 dígitos).");
  if (!profile.defaultItemListaServico)
    errors.push("Item da lista de serviço (LC 116) não configurado.");
  else if (!/^\d{6}$/.test(profile.defaultItemListaServico))
    errors.push(
      "Item da lista de serviço deve ter 6 dígitos numéricos (2 para item, 2 para subitem e 2 para desdobro nacional). Atualize o cadastro da empresa.",
    );
  if (requirements.requiresCodigoCnae) {
    const cnaeDigits = requirements.requiresCodigoCnae.digits;
    if (!profile.defaultCodigoCnae)
      errors.push(
        `Este município exige o código CNAE do serviço (${cnaeDigits} dígitos). Configure no perfil fiscal.`,
      );
    else if (profile.defaultCodigoCnae.length !== cnaeDigits)
      errors.push(
        `Este município exige CNAE com ${cnaeDigits} dígitos — o configurado tem ${profile.defaultCodigoCnae.length}. Atualize o perfil fiscal.`,
      );
  }
  if (
    requirements.requiresCodigoTributarioMunicipio &&
    !profile.defaultCodigoTributarioMunicipio
  )
    errors.push(
      "Este município exige o código tributário municipal do serviço. Configure no perfil fiscal.",
    );
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

  if (requirements.requiresTomadorEndereco) {
    if (!overrides.tomadorCodigoMunicipio)
      errors.push("Código de município do tomador obrigatório.");
    if (!overrides.tomadorLogradouro)
      errors.push("Logradouro do tomador obrigatório.");
    if (!overrides.tomadorNumero)
      errors.push("Número do endereço do tomador obrigatório.");
    if (!overrides.tomadorBairro)
      errors.push("Bairro do tomador obrigatório.");
    const tomadorCepDigits = (overrides.tomadorCep ?? "").replace(/\D/g, "");
    if (tomadorCepDigits.length !== 8)
      errors.push("CEP do tomador obrigatório (deve ter 8 dígitos).");
    if (!overrides.tomadorUf) errors.push("UF do tomador obrigatória.");
  }

  return { valid: errors.length === 0, errors };
}

export function buildNfsePayload(
  source: FiscalIssueSource,
  profile: FiscalCompanyProfile,
  overrides: IssueOverrides,
  requirements: MunicipioNfseRequirements,
): NfsePayload {
  // Filosofia superset: endereço entra sempre que os dados existirem, mesmo quando
  // o município não exige — prefeituras ignoram campos que não usam.
  const hasEnderecoTomador = Boolean(
    overrides.tomadorLogradouro &&
    overrides.tomadorNumero &&
    overrides.tomadorBairro &&
    overrides.tomadorCodigoMunicipio &&
    overrides.tomadorUf,
  );
  const enderecoTomador: NfseEndereco | undefined = hasEnderecoTomador
    ? {
        logradouro: overrides.tomadorLogradouro!,
        numero: overrides.tomadorNumero!,
        ...(overrides.tomadorComplemento?.trim()
          ? { complemento: overrides.tomadorComplemento.trim() }
          : {}),
        bairro: overrides.tomadorBairro!,
        codigo_municipio: overrides.tomadorCodigoMunicipio!,
        uf: overrides.tomadorUf!,
        cep: (overrides.tomadorCep ?? "").replace(/\D/g, ""),
      }
    : undefined;

  const tomador =
    overrides.tipoTomador === "PJ"
      ? {
          cnpj: (overrides.tomadorCnpj ?? "").replace(/\D/g, ""),
          razao_social: overrides.tomadorRazaoSocial!,
          ...(overrides.tomadorEmail?.trim()
            ? { email: overrides.tomadorEmail.trim() }
            : {}),
          ...(enderecoTomador ? { endereco: enderecoTomador } : {}),
        }
      : {
          cpf: (overrides.tomadorCpf ?? "").replace(/\D/g, ""),
          razao_social: overrides.tomadorNome!,
          ...(overrides.tomadorEmail?.trim()
            ? { email: overrides.tomadorEmail.trim() }
            : {}),
          ...(enderecoTomador ? { endereco: enderecoTomador } : {}),
        };

  return {
    data_emissao: dayjs().tz(TIMEZONE).format(),
    data_competencia: overrides.dataCompetencia.toISOString(),
    natureza_operacao: overrides.naturezaOperacao ?? "1",
    optante_simples_nacional: profile.optanteSimplesNacional,
    regime_especial_tributacao:
      overrides.regimeEspecialTributacao ??
      (profile.regimeEspecialTributacao
        ? Number(profile.regimeEspecialTributacao)
        : undefined),
    prestador: {
      cnpj: profile.cnpj.replace(/\D/g, ""),
      inscricao_municipal: profile.inscricaoMunicipal,
      codigo_municipio: profile.codigoMunicipio,
    },
    tomador,
    servico: {
      aliquota: Number(
        Number(profile.defaultAliquotaIss).toFixed(
          requirements.aliquotaDecimals,
        ),
      ),
      iss_retido: profile.defaultIssRetido,
      item_lista_servico: profile.defaultItemListaServico,
      ...(profile.defaultCodigoCnae
        ? { codigo_cnae: profile.defaultCodigoCnae }
        : {}),
      ...(requirements.usesCodigoTributarioMunicipio &&
      profile.defaultCodigoTributarioMunicipio
        ? {
            codigo_tributario_municipio:
              profile.defaultCodigoTributarioMunicipio,
          }
        : {}),
      discriminacao:
        overrides.discriminacao?.trim() ||
        profile.defaultDiscriminacao?.trim() ||
        source.defaultDescription,
      codigo_municipio:
        overrides.tomadorCodigoMunicipio ?? profile.codigoMunicipio,
      valor_servicos: source.amount,
    },
  };
}
