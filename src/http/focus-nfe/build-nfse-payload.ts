import type {
  FiscalCompanyProfile,
  ForgeContract,
  TomadorType,
} from "@/generated/prisma/client";
import type { NfsePayload } from "./types";

export type IssueOverrides = {
  tipoTomador: TomadorType;
  discriminacao?: string;
  dataCompetencia: Date;
  naturezaOperacao?: string;
  regimeEspecialTributacao?: number;
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
  tomadorUf?: string;
  tomadorCep?: string;
};

export type PreflightResult = {
  valid: boolean;
  errors: string[];
};

export function validateBeforeEmit(
  contract: ForgeContract,
  profile: FiscalCompanyProfile,
  overrides: IssueOverrides,
): PreflightResult {
  const errors: string[] = [];

  if (!profile.supportedByFocus)
    errors.push("Município do prestador não está integrado na Focus NFe.");
  if (!profile.focusEmpresaRegistered)
    errors.push("Empresa não está cadastrada na Focus NFe.");
  if (!profile.inscricaoMunicipal)
    errors.push("Inscrição municipal do prestador não configurada.");
  if (!/^\d{7}$/.test(profile.codigoMunicipio))
    errors.push("Código IBGE do município inválido (deve ter 7 dígitos).");
  if (!profile.defaultItemListaServico)
    errors.push("Item da lista de serviço (LC 116) não configurado.");
  if (Number(profile.defaultAliquotaIss) <= 0)
    errors.push("Alíquota ISS inválida.");
  if (Number(contract.value) <= 0)
    errors.push("Valor do contrato deve ser maior que zero.");

  if (overrides.tipoTomador === "PJ") {
    const cnpj = (overrides.tomadorCnpj ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) errors.push("CNPJ do tomador inválido.");
    if (!overrides.tomadorRazaoSocial)
      errors.push("Razão social do tomador obrigatória para PJ.");
    if (!overrides.tomadorCodigoMunicipio)
      errors.push("Código de município do tomador obrigatório para PJ.");
  } else {
    const cpf = (overrides.tomadorCpf ?? "").replace(/\D/g, "");
    if (cpf.length !== 11) errors.push("CPF do tomador inválido.");
    if (!overrides.tomadorNome)
      errors.push("Nome do tomador obrigatório para PF.");
  }

  return { valid: errors.length === 0, errors };
}

export function buildNfsePayload(
  contract: ForgeContract,
  profile: FiscalCompanyProfile,
  overrides: IssueOverrides,
): NfsePayload {
  const tomador =
    overrides.tipoTomador === "PJ"
      ? {
          cnpj: (overrides.tomadorCnpj ?? "").replace(/\D/g, ""),
          razao_social: overrides.tomadorRazaoSocial!,
          email: overrides.tomadorEmail,
          endereco: {
            logradouro: overrides.tomadorLogradouro!,
            numero: overrides.tomadorNumero!,
            complemento: overrides.tomadorComplemento,
            bairro: overrides.tomadorBairro!,
            codigo_municipio: overrides.tomadorCodigoMunicipio!,
            uf: overrides.tomadorUf!,
            cep: (overrides.tomadorCep ?? "").replace(/\D/g, ""),
          },
        }
      : {
          cpf: (overrides.tomadorCpf ?? "").replace(/\D/g, ""),
          razao_social: overrides.tomadorNome!,
          email: overrides.tomadorEmail,
        };

  return {
    data_emissao: new Date().toISOString(),
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
      aliquota: Number(profile.defaultAliquotaIss),
      iss_retido: profile.defaultIssRetido,
      item_lista_servico: profile.defaultItemListaServico,
      discriminacao:
        overrides.discriminacao ??
        profile.defaultDiscriminacao ??
        `Serviços conforme contrato #${contract.number}`,
      codigo_municipio: overrides.tomadorCodigoMunicipio ?? profile.codigoMunicipio,
      valor_servicos: Number(contract.value),
    },
  };
}
