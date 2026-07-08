import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type {
  FiscalCompanyProfile,
  ForgeContract,
} from "@/generated/prisma/client";
import type { NfseNacionalPayload } from "./types";
import type { IssueOverrides, PreflightResult } from "./build-nfse-payload";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Sao_Paulo";

// codigo_opcao_simples_nacional (DPS nacional): 1 = Não Optante, 2 = MEI, 3 = Optante ME/EPP.
function toCodigoOpcaoSimplesNacional(optante: boolean, mei: boolean): number {
  if (mei) return 2;
  return optante ? 3 : 1;
}

// regime_especial_tributacao é obrigatório na DPS nacional; 0 = Nenhum quando não configurado.
const REGIME_ESPECIAL_TRIBUTACAO_NENHUM = 0;

type ReformaTributaria = Pick<
  NfseNacionalPayload,
  | "finalidade_emissao"
  | "consumidor_final"
  | "indicador_destinatario"
  | "ibs_cbs_situacao_tributaria"
  | "ibs_cbs_classificacao_tributaria"
>;

// Bloco IBS/CBS só é enviado quando CST + classificação estão configurados (perfil ou override).
function buildReformaTributaria(
  profile: FiscalCompanyProfile,
  overrides: IssueOverrides,
): ReformaTributaria {
  const situacaoTributaria =
    overrides.ibsCbsSituacaoTributaria ?? profile.ibsCbsSituacaoTributaria;
  const classificacaoTributaria =
    overrides.ibsCbsClassificacaoTributaria ??
    profile.ibsCbsClassificacaoTributaria;

  if (!situacaoTributaria || !classificacaoTributaria) return {};

  const consumidorFinal =
    overrides.consumidorFinal ?? profile.defaultConsumidorFinal;

  return {
    finalidade_emissao: 0,
    indicador_destinatario: 0,
    consumidor_final: consumidorFinal ? 1 : 0,
    ibs_cbs_situacao_tributaria: situacaoTributaria,
    ibs_cbs_classificacao_tributaria: classificacaoTributaria,
  };
}

// tributacao_iss → tribISSQN: situação tributária do ISSQN (enum 1–4, não a alíquota).
// 1 = Operação tributável | 2 = Imunidade | 3 = Exportação de serviços | 4 = Não incidência.
const TRIBUTACAO_ISS_OPERACAO_TRIBUTAVEL = 1;

function toTributacaoIssqn(value: number | null | undefined): number {
  return value && value >= 1 && value <= 4
    ? value
    : TRIBUTACAO_ISS_OPERACAO_TRIBUTAVEL;
}

// tipo_retencao_iss → tpRetISSQN: 1=Não retido, 2=Retido pelo tomador, 3=Retido pelo intermediário.
const TIPO_RETENCAO_ISS_NAO_RETIDO = 1;
const TIPO_RETENCAO_ISS_RETIDO_TOMADOR = 2;

// dCompet exige data pura (YYYY-MM-DD). ISO date-only é sempre UTC → sem off-by-one.
function toCompetenciaDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function resolveNomeTomador(overrides: IssueOverrides): string {
  return (overrides.tomadorRazaoSocial ?? overrides.tomadorNome ?? "").trim();
}

// O documento do prestador mora numa única coluna (`profile.cnpj`), podendo ser
// CNPJ (14 dígitos) ou CPF (11). A DPS nacional tem campos separados, então
// roteamos pelo comprimento — CPF nunca pode ir no cnpj_prestador.
function resolvePrestadorDocumento(
  cnpjOuCpf: string,
): { cnpj_prestador: string } | { cpf_prestador: string } {
  const digits = cnpjOuCpf.replace(/\D/g, "");
  return digits.length === 11
    ? { cpf_prestador: digits }
    : { cnpj_prestador: digits };
}

export function validateNacionalBeforeEmit(
  contract: ForgeContract,
  profile: FiscalCompanyProfile,
  overrides: IssueOverrides,
): PreflightResult {
  const errors: string[] = [];

  if (!profile.focusEmpresaRegistered)
    errors.push("Empresa não está cadastrada na Focus NFe.");
  if (!/^\d{7}$/.test(profile.codigoMunicipio))
    errors.push("Código IBGE do município emissor inválido (deve ter 7 dígitos).");
  if (!profile.defaultItemListaServico)
    errors.push("Código de tributação nacional do ISSQN não configurado.");
  else if (!/^\d{6}$/.test(profile.defaultItemListaServico))
    errors.push(
      "Código de tributação nacional do ISSQN deve ter 6 dígitos numéricos. Atualize o cadastro da empresa.",
    );
  if (Number(profile.defaultAliquotaIss) <= 0)
    errors.push("Alíquota ISS inválida.");
  if (Number(contract.value) <= 0)
    errors.push("Valor do contrato deve ser maior que zero.");

  if (overrides.tipoTomador === "PJ") {
    const cnpj = (overrides.tomadorCnpj ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) errors.push("CNPJ do tomador inválido.");
  } else {
    const cpf = (overrides.tomadorCpf ?? "").replace(/\D/g, "");
    if (cpf.length !== 11) errors.push("CPF do tomador inválido.");
  }

  if (!resolveNomeTomador(overrides))
    errors.push("Nome/razão social do tomador é obrigatório.");

  const situacaoTributaria =
    overrides.ibsCbsSituacaoTributaria ?? profile.ibsCbsSituacaoTributaria;
  const classificacaoTributaria =
    overrides.ibsCbsClassificacaoTributaria ??
    profile.ibsCbsClassificacaoTributaria;
  if (Boolean(situacaoTributaria) !== Boolean(classificacaoTributaria))
    errors.push(
      "IBS/CBS: informe situação tributária (CST) e classificação tributária juntas.",
    );
  if (situacaoTributaria && !/^\d{1,3}$/.test(situacaoTributaria))
    errors.push("IBS/CBS: situação tributária (CST) deve ter 1 a 3 dígitos.");
  if (classificacaoTributaria && !/^\d{6}$/.test(classificacaoTributaria))
    errors.push("IBS/CBS: classificação tributária deve ter 6 dígitos.");

  return { valid: errors.length === 0, errors };
}

export function buildNfseNacionalPayload(
  contract: ForgeContract,
  profile: FiscalCompanyProfile,
  overrides: IssueOverrides,
): NfseNacionalPayload {
  const tomador =
    overrides.tipoTomador === "PJ"
      ? { cnpj_tomador: (overrides.tomadorCnpj ?? "").replace(/\D/g, "") }
      : { cpf_tomador: (overrides.tomadorCpf ?? "").replace(/\D/g, "") };

  return {
    data_emissao: dayjs().tz(TIMEZONE).format(),
    serie_dps: profile.defaultSerieDps ?? 1,
    ...(overrides.dataCompetencia
      ? { data_competencia: toCompetenciaDate(overrides.dataCompetencia) }
      : {}),
    emitente_dps: 1,
    codigo_municipio_emissora: Number(profile.codigoMunicipio),
    ...resolvePrestadorDocumento(profile.cnpj),
    codigo_opcao_simples_nacional: toCodigoOpcaoSimplesNacional(
      profile.optanteSimplesNacional,
      profile.simplesNacionalMei,
    ),
    regime_especial_tributacao:
      overrides.regimeEspecialTributacao ??
      (profile.regimeEspecialTributacao
        ? Number(profile.regimeEspecialTributacao)
        : REGIME_ESPECIAL_TRIBUTACAO_NENHUM),
    ...tomador,
    razao_social_tomador: resolveNomeTomador(overrides),
    // ISS devido no local do estabelecimento prestador (LC 116/2003, art. 3º caput).
    codigo_municipio_prestacao: Number(profile.codigoMunicipio),
    codigo_tributacao_nacional_iss: profile.defaultItemListaServico,
    descricao_servico:
      overrides.discriminacao?.trim() ||
      profile.defaultDiscriminacao?.trim() ||
      `Serviços conforme contrato #${contract.number}`,
    valor_servico: Number(contract.value),
    tributacao_iss: toTributacaoIssqn(profile.defaultTributacaoIssqn),
    // TODO(verificar-homologacao): a doc oficial nomeia este campo como
    // `percentual_aliquota_relativa_municipio`. Renomear após confirmar que a Focus
    // aceita o nome novo em homologação (senão o ISS sai zerado).
    aliquota: Number(profile.defaultAliquotaIss),
    tipo_retencao_iss: profile.defaultIssRetido
      ? TIPO_RETENCAO_ISS_RETIDO_TOMADOR
      : TIPO_RETENCAO_ISS_NAO_RETIDO,
    ...buildReformaTributaria(profile, overrides),
  };
}
