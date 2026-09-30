import { OFFICIAL_LINKS, type GlossaryLink } from "../glossary/terms";
import type { TaxRegimeCode } from "../tax/types";

// Catálogo de documentos da empresa. Fica em código (não em seed) para que
// cada org receba a versão mais nova sem migração de dados; ajustes por org
// moram em `CompanyDocumentRequirement`.

export type DocumentGroup =
  | "SOCIETARIO"
  | "CADASTROS"
  | "CERTIFICADOS"
  | "LICENCAS"
  | "CERTIDOES"
  | "LIVROS"
  | "DECLARACOES"
  | "GUIAS"
  | "TRABALHISTA"
  | "NOTAS"
  | "LGPD";

export type DocumentRecurrence = "ONE_TIME" | "PER_VALIDITY" | "ANNUAL" | "MONTHLY";

export type DocumentScope = "FEDERAL" | "ESTADUAL" | "MUNICIPAL" | "TRABALHISTA" | "SOCIETARIO" | "FISCAL_CONTABIL";

export interface ApplicabilityRule {
  regimes?: TaxRegimeCode[];
  requiresEmployees?: boolean;
  requiresIcms?: boolean;
  requiresIss?: boolean;
  /** Itens de atividade regulada (licença sanitária, ambiental...) nascem desligados. */
  isOptInOnly?: boolean;
}

export interface CompanyDocumentType {
  code: string;
  label: string;
  group: DocumentGroup;
  scope: DocumentScope;
  authority: string;
  recurrence: DocumentRecurrence;
  defaultValidityDays: number | null;
  /** 3 = crítico, 2 = importante, 1 = recomendado. */
  weight: 1 | 2 | 3;
  /** Vencido impede licitação, emissão de nota ou crédito. */
  blockingImpact: string | null;
  applicability: ApplicabilityRule;
  officialLinks: GlossaryLink[];
  glossaryTermId: string | null;
  description: string;
  /** Dia do mês (ou mês/dia para anuais) em que a obrigação vence. */
  dueDay?: number;
  dueMonth?: number;
}

export const DOCUMENT_GROUP_LABELS: Record<DocumentGroup, string> = {
  SOCIETARIO: "Societário",
  CADASTROS: "Cadastros e inscrições",
  CERTIFICADOS: "Certificados digitais",
  LICENCAS: "Alvarás e licenças",
  CERTIDOES: "Certidões e regularidade",
  LIVROS: "Livros e demonstrações",
  DECLARACOES: "Declarações",
  GUIAS: "Guias e comprovantes",
  TRABALHISTA: "Trabalhista",
  NOTAS: "Notas fiscais do mês",
  LGPD: "LGPD",
};

export const DOCUMENT_SCOPE_LABELS: Record<DocumentScope, string> = {
  FEDERAL: "Federal",
  ESTADUAL: "Estadual",
  MUNICIPAL: "Municipal",
  TRABALHISTA: "Trabalhista",
  SOCIETARIO: "Societário",
  FISCAL_CONTABIL: "Fiscal/Contábil",
};

const NOT_MEI: TaxRegimeCode[] = ["SIMPLES", "PRESUMIDO", "REAL"];
const SIMPLES_LIKE: TaxRegimeCode[] = ["SIMPLES"];
const PROFIT_REGIMES: TaxRegimeCode[] = ["PRESUMIDO", "REAL"];

function doc(definition: CompanyDocumentType): CompanyDocumentType {
  return definition;
}

export const COMPANY_DOCUMENT_TYPES: CompanyDocumentType[] = [
  // ── Societário
  doc({ code: "CONTRATO_SOCIAL", label: "Contrato social consolidado (ou CCMEI / Requerimento de Empresário)", group: "SOCIETARIO", scope: "SOCIETARIO", authority: "JUCEPI", recurrence: "ONE_TIME", defaultValidityDays: null, weight: 3, blockingImpact: "Sem ele não se abre conta PJ, não se participa de licitação nem se altera cadastro.", applicability: {}, officialLinks: [OFFICIAL_LINKS.jucepi], glossaryTermId: null, description: "Última versão consolidada, com todas as alterações." }),
  doc({ code: "CERTIDAO_SIMPLIFICADA", label: "Certidão simplificada da Junta Comercial", group: "SOCIETARIO", scope: "SOCIETARIO", authority: "JUCEPI", recurrence: "PER_VALIDITY", defaultValidityDays: 90, weight: 2, blockingImpact: "Exigida em licitações e bancos (normalmente emitida há até 90 dias).", applicability: {}, officialLinks: [OFFICIAL_LINKS.jucepi], glossaryTermId: null, description: "Resumo oficial dos sócios, capital e atividades." }),
  doc({ code: "ACORDO_SOCIOS", label: "Acordo de sócios", group: "SOCIETARIO", scope: "SOCIETARIO", authority: "Sócios", recurrence: "ONE_TIME", defaultValidityDays: null, weight: 1, blockingImpact: null, applicability: { regimes: NOT_MEI, isOptInOnly: true }, officialLinks: [], glossaryTermId: null, description: "Regras entre os sócios (saída, sucessão, distribuição)." }),
  doc({ code: "PROCURACAO_ECAC", label: "Procuração eletrônica no e-CAC", group: "SOCIETARIO", scope: "FEDERAL", authority: "Receita Federal", recurrence: "PER_VALIDITY", defaultValidityDays: 1825, weight: 1, blockingImpact: null, applicability: { isOptInOnly: true }, officialLinks: [OFFICIAL_LINKS.ecac], glossaryTermId: null, description: "Autoriza contador/parceiro a agir no e-CAC em nome da empresa." }),
  // ── Cadastros
  doc({ code: "CARTAO_CNPJ", label: "Cartão CNPJ", group: "CADASTROS", scope: "FEDERAL", authority: "Receita Federal", recurrence: "PER_VALIDITY", defaultValidityDays: 90, weight: 2, blockingImpact: null, applicability: {}, officialLinks: [OFFICIAL_LINKS.cnpjCard], glossaryTermId: "cnae", description: "Comprovante de inscrição e situação cadastral. Emita de novo a cada trimestre para manter atualizado." }),
  doc({ code: "CARTAO_IE", label: "Cartão de Inscrição Estadual", group: "CADASTROS", scope: "ESTADUAL", authority: "SEFAZ-PI", recurrence: "ONE_TIME", defaultValidityDays: null, weight: 2, blockingImpact: "Sem IE ativa não se emite NF-e de mercadoria.", applicability: { requiresIcms: true }, officialLinks: [OFFICIAL_LINKS.sefazPi], glossaryTermId: "icms", description: "Inscrição no cadastro de contribuintes do ICMS do Piauí." }),
  doc({ code: "CARTAO_IM", label: "Cartão de Inscrição Municipal", group: "CADASTROS", scope: "MUNICIPAL", authority: "SEMF Teresina", recurrence: "ONE_TIME", defaultValidityDays: null, weight: 2, blockingImpact: "Sem IM não se emite NFS-e.", applicability: { requiresIss: true }, officialLinks: [OFFICIAL_LINKS.semfTeresina], glossaryTermId: "iss", description: "Inscrição no cadastro mobiliário da prefeitura." }),
  doc({ code: "TERMO_OPCAO_SIMPLES", label: "Termo de opção pelo Simples Nacional", group: "CADASTROS", scope: "FEDERAL", authority: "Receita Federal", recurrence: "ONE_TIME", defaultValidityDays: null, weight: 1, blockingImpact: null, applicability: { regimes: SIMPLES_LIKE }, officialLinks: [OFFICIAL_LINKS.simplesPortal], glossaryTermId: "simples-nacional", description: "Comprovante do enquadramento no Simples." }),
  // ── Certificados
  doc({ code: "CERTIFICADO_ECNPJ", label: "Certificado digital e-CNPJ (A1/A3)", group: "CERTIFICADOS", scope: "FEDERAL", authority: "Autoridade Certificadora ICP-Brasil", recurrence: "PER_VALIDITY", defaultValidityDays: 365, weight: 3, blockingImpact: "Vencido: não se emite nota nem se acessa o e-CAC.", applicability: { regimes: NOT_MEI }, officialLinks: [OFFICIAL_LINKS.ecac], glossaryTermId: "certificado-digital", description: "Suba o comprovante; o arquivo .pfx vai no cofre de certificados." }),
  doc({ code: "CERTIFICADO_ECPF_SOCIOS", label: "e-CPF dos sócios", group: "CERTIFICADOS", scope: "FEDERAL", authority: "Autoridade Certificadora ICP-Brasil", recurrence: "PER_VALIDITY", defaultValidityDays: 365, weight: 1, blockingImpact: null, applicability: { isOptInOnly: true }, officialLinks: [], glossaryTermId: "certificado-digital", description: "Necessário para assinar declarações como pessoa física." }),
  // ── Licenças
  doc({ code: "ALVARA_FUNCIONAMENTO", label: "Alvará de funcionamento", group: "LICENCAS", scope: "MUNICIPAL", authority: "Prefeitura de Teresina", recurrence: "PER_VALIDITY", defaultValidityDays: 365, weight: 3, blockingImpact: "Funcionar sem alvará sujeita a multa e interdição.", applicability: {}, officialLinks: [OFFICIAL_LINKS.semfTeresina], glossaryTermId: null, description: "Licença de localização e funcionamento." }),
  doc({ code: "LICENCA_SANITARIA", label: "Licença sanitária (VISA)", group: "LICENCAS", scope: "MUNICIPAL", authority: "Vigilância Sanitária", recurrence: "PER_VALIDITY", defaultValidityDays: 365, weight: 2, blockingImpact: "Obrigatória para alimentação, saúde, estética e similares.", applicability: { isOptInOnly: true }, officialLinks: [], glossaryTermId: null, description: "Só para atividades sujeitas à vigilância sanitária." }),
  doc({ code: "AVCB", label: "AVCB/CLCB do Corpo de Bombeiros", group: "LICENCAS", scope: "ESTADUAL", authority: "Corpo de Bombeiros do Piauí", recurrence: "PER_VALIDITY", defaultValidityDays: 365, weight: 2, blockingImpact: "Exigido para o alvará em imóveis com atendimento ao público.", applicability: { isOptInOnly: true }, officialLinks: [], glossaryTermId: null, description: "Certificado de vistoria contra incêndio." }),
  doc({ code: "LICENCA_AMBIENTAL", label: "Licença ambiental", group: "LICENCAS", scope: "ESTADUAL", authority: "SEMAR-PI / SEMAM", recurrence: "PER_VALIDITY", defaultValidityDays: 1460, weight: 2, blockingImpact: null, applicability: { isOptInOnly: true }, officialLinks: [], glossaryTermId: null, description: "Para atividades com impacto ambiental." }),
  doc({ code: "REGISTRO_CONSELHO", label: "Registro no conselho de classe (CRC, CREA, CRM...)", group: "LICENCAS", scope: "FEDERAL", authority: "Conselho profissional", recurrence: "PER_VALIDITY", defaultValidityDays: 365, weight: 2, blockingImpact: "Atividade regulamentada sem registro é exercício irregular.", applicability: { isOptInOnly: true }, officialLinks: [], glossaryTermId: null, description: "Registro da empresa e anuidade em dia." }),
  doc({ code: "CONTRATO_LOCACAO_IPTU", label: "Contrato de locação e IPTU do endereço", group: "LICENCAS", scope: "MUNICIPAL", authority: "Prefeitura", recurrence: "ANNUAL", defaultValidityDays: 365, weight: 1, blockingImpact: null, applicability: {}, officialLinks: [], glossaryTermId: null, description: "Comprova o endereço da sede." }),
  // ── Certidões
  doc({ code: "CND_FEDERAL", label: "CND Federal (Receita Federal e PGFN)", group: "CERTIDOES", scope: "FEDERAL", authority: "Receita Federal / PGFN", recurrence: "PER_VALIDITY", defaultValidityDays: 180, weight: 3, blockingImpact: "Vencida ou positiva: fora de licitações, crédito bancário e alguns contratos.", applicability: {}, officialLinks: [OFFICIAL_LINKS.cndFederal], glossaryTermId: "cnd", description: "Certidão conjunta de débitos federais e dívida ativa da União." }),
  doc({ code: "CND_ESTADUAL", label: "CND Estadual (SEFAZ-PI)", group: "CERTIDOES", scope: "ESTADUAL", authority: "SEFAZ-PI", recurrence: "PER_VALIDITY", defaultValidityDays: 60, weight: 3, blockingImpact: "Exigida em licitações estaduais e municipais.", applicability: {}, officialLinks: [OFFICIAL_LINKS.sefazPi], glossaryTermId: "cnd", description: "Certidão de débitos com o Estado do Piauí." }),
  doc({ code: "CND_MUNICIPAL", label: "CND Municipal (Teresina)", group: "CERTIDOES", scope: "MUNICIPAL", authority: "SEMF Teresina", recurrence: "PER_VALIDITY", defaultValidityDays: 90, weight: 3, blockingImpact: "Exigida em licitações e na renovação do alvará.", applicability: {}, officialLinks: [OFFICIAL_LINKS.semfTeresina], glossaryTermId: "cnd", description: "Certidão de débitos com o município." }),
  doc({ code: "CRF_FGTS", label: "CRF do FGTS (Caixa)", group: "CERTIDOES", scope: "TRABALHISTA", authority: "Caixa Econômica Federal", recurrence: "PER_VALIDITY", defaultValidityDays: 30, weight: 3, blockingImpact: "Obrigatório em licitações e financiamentos.", applicability: {}, officialLinks: [OFFICIAL_LINKS.crfFgts], glossaryTermId: "crf-fgts", description: "Certificado de Regularidade do FGTS." }),
  doc({ code: "CNDT", label: "CNDT — Certidão Negativa de Débitos Trabalhistas", group: "CERTIDOES", scope: "TRABALHISTA", authority: "TST", recurrence: "PER_VALIDITY", defaultValidityDays: 180, weight: 3, blockingImpact: "Obrigatória em licitações.", applicability: {}, officialLinks: [OFFICIAL_LINKS.cndt], glossaryTermId: "cndt", description: "Débitos em processos trabalhistas." }),
  doc({ code: "CERTIDAO_FALENCIA", label: "Certidão de falência e recuperação judicial (TJ-PI)", group: "CERTIDOES", scope: "ESTADUAL", authority: "Tribunal de Justiça do Piauí", recurrence: "PER_VALIDITY", defaultValidityDays: 90, weight: 1, blockingImpact: "Exigida em licitações.", applicability: { isOptInOnly: true }, officialLinks: [], glossaryTermId: null, description: "Só se a empresa participa de licitações." }),
  // ── Livros e demonstrações
  doc({ code: "LIVRO_DIARIO_RAZAO", label: "Livro Diário e Razão (ECD)", group: "LIVROS", scope: "FISCAL_CONTABIL", authority: "Receita Federal (SPED)", recurrence: "ANNUAL", defaultValidityDays: 365, weight: 2, blockingImpact: null, applicability: { regimes: PROFIT_REGIMES }, officialLinks: [OFFICIAL_LINKS.ecac], glossaryTermId: "razao", description: "Escrituração contábil digital do ano anterior.", dueMonth: 6, dueDay: 30 }),
  doc({ code: "LIVRO_CAIXA", label: "Livro Caixa", group: "LIVROS", scope: "FISCAL_CONTABIL", authority: "Empresa", recurrence: "ANNUAL", defaultValidityDays: 365, weight: 1, blockingImpact: null, applicability: { regimes: ["MEI", "SIMPLES"] }, officialLinks: [], glossaryTermId: null, description: "Registro de entradas e saídas do ano (exigido do Simples que não tem escrituração completa)." }),
  doc({ code: "BALANCETE_MENSAL", label: "Balancete do mês", group: "LIVROS", scope: "FISCAL_CONTABIL", authority: "Empresa", recurrence: "MONTHLY", defaultValidityDays: null, weight: 1, blockingImpact: null, applicability: { regimes: NOT_MEI }, officialLinks: [], glossaryTermId: "balancete", description: "Gerado pela própria aba Contábil ao fechar o mês.", dueDay: 15 }),
  doc({ code: "BALANCO_DRE_ANUAL", label: "Balanço patrimonial e DRE do ano", group: "LIVROS", scope: "FISCAL_CONTABIL", authority: "Empresa", recurrence: "ANNUAL", defaultValidityDays: 365, weight: 2, blockingImpact: "Pedidos por bancos e licitações.", applicability: { regimes: NOT_MEI }, officialLinks: [], glossaryTermId: "balanco", description: "Demonstrações do exercício anterior.", dueMonth: 4, dueDay: 30 }),
  doc({ code: "LIVROS_FISCAIS", label: "Livros fiscais (entradas, saídas e ISS)", group: "LIVROS", scope: "FISCAL_CONTABIL", authority: "SEFAZ-PI / Prefeitura", recurrence: "MONTHLY", defaultValidityDays: null, weight: 1, blockingImpact: null, applicability: { regimes: PROFIT_REGIMES }, officialLinks: [OFFICIAL_LINKS.sefazPi], glossaryTermId: null, description: "Registro mensal das notas de entrada e saída.", dueDay: 20 }),
  // ── Declarações
  doc({ code: "DEFIS", label: "DEFIS (Simples Nacional)", group: "DECLARACOES", scope: "FEDERAL", authority: "Receita Federal", recurrence: "ANNUAL", defaultValidityDays: 365, weight: 2, blockingImpact: "Atraso gera multa e bloqueia o PGDAS-D.", applicability: { regimes: SIMPLES_LIKE }, officialLinks: [OFFICIAL_LINKS.simplesPortal], glossaryTermId: "obrigacao-acessoria", description: "Declaração anual do Simples.", dueMonth: 3, dueDay: 31 }),
  doc({ code: "DASN_SIMEI", label: "DASN-SIMEI (declaração anual do MEI)", group: "DECLARACOES", scope: "FEDERAL", authority: "Receita Federal", recurrence: "ANNUAL", defaultValidityDays: 365, weight: 3, blockingImpact: "Sem ela o MEI não emite o DAS do ano seguinte.", applicability: { regimes: ["MEI"] }, officialLinks: [OFFICIAL_LINKS.meiPortal], glossaryTermId: "mei", description: "Faturamento do ano anterior.", dueMonth: 5, dueDay: 31 }),
  doc({ code: "ECF", label: "ECF (Escrituração Contábil Fiscal)", group: "DECLARACOES", scope: "FEDERAL", authority: "Receita Federal (SPED)", recurrence: "ANNUAL", defaultValidityDays: 365, weight: 2, blockingImpact: null, applicability: { regimes: PROFIT_REGIMES }, officialLinks: [OFFICIAL_LINKS.ecac], glossaryTermId: "lalur", description: "Apuração anual do IRPJ/CSLL.", dueMonth: 7, dueDay: 31 }),
  doc({ code: "DCTFWEB", label: "DCTFWeb", group: "DECLARACOES", scope: "FEDERAL", authority: "Receita Federal", recurrence: "MONTHLY", defaultValidityDays: null, weight: 2, blockingImpact: "Sem ela não se emite a CND Federal.", applicability: { regimes: NOT_MEI }, officialLinks: [OFFICIAL_LINKS.ecac], glossaryTermId: "obrigacao-acessoria", description: "Confissão mensal de contribuições previdenciárias e retenções.", dueDay: 15 }),
  doc({ code: "EFD_REINF", label: "EFD-Reinf", group: "DECLARACOES", scope: "FEDERAL", authority: "Receita Federal", recurrence: "MONTHLY", defaultValidityDays: null, weight: 1, blockingImpact: null, applicability: { regimes: NOT_MEI }, officialLinks: [OFFICIAL_LINKS.ecac], glossaryTermId: "obrigacao-acessoria", description: "Retenções e rendimentos pagos (substituiu a DIRF).", dueDay: 15 }),
  doc({ code: "ESOCIAL", label: "eSocial (recibos do mês)", group: "DECLARACOES", scope: "TRABALHISTA", authority: "Governo Federal", recurrence: "MONTHLY", defaultValidityDays: null, weight: 2, blockingImpact: null, applicability: { regimes: NOT_MEI }, officialLinks: [OFFICIAL_LINKS.esocial], glossaryTermId: "obrigacao-acessoria", description: "Folha e pró-labore informados.", dueDay: 15 }),
  doc({ code: "EFD_ICMS_IPI", label: "EFD ICMS/IPI (SPED Fiscal)", group: "DECLARACOES", scope: "ESTADUAL", authority: "SEFAZ-PI", recurrence: "MONTHLY", defaultValidityDays: null, weight: 2, blockingImpact: null, applicability: { regimes: PROFIT_REGIMES, requiresIcms: true }, officialLinks: [OFFICIAL_LINKS.sefazPi], glossaryTermId: "obrigacao-acessoria", description: "Escrituração fiscal do ICMS.", dueDay: 15 }),
  doc({ code: "DIRPF_SOCIOS", label: "Declaração de IR dos sócios (DIRPF)", group: "DECLARACOES", scope: "FEDERAL", authority: "Receita Federal", recurrence: "ANNUAL", defaultValidityDays: 365, weight: 1, blockingImpact: null, applicability: {}, officialLinks: [OFFICIAL_LINKS.ecac], glossaryTermId: "carne-leao", description: "Recibo de entrega da declaração dos sócios.", dueMonth: 5, dueDay: 31 }),
  // ── Guias mensais
  doc({ code: "GUIA_DAS", label: "DAS pago", group: "GUIAS", scope: "FEDERAL", authority: "Receita Federal", recurrence: "MONTHLY", defaultValidityDays: null, weight: 3, blockingImpact: "DAS em aberto impede a CND Federal e pode excluir do Simples.", applicability: { regimes: ["MEI", "SIMPLES"] }, officialLinks: [OFFICIAL_LINKS.simplesPortal], glossaryTermId: "das", description: "Guia do mês anterior paga até o dia 20.", dueDay: 20 }),
  doc({ code: "GUIA_DARF", label: "DARF de IRPJ/CSLL/PIS/COFINS pago", group: "GUIAS", scope: "FEDERAL", authority: "Receita Federal", recurrence: "MONTHLY", defaultValidityDays: null, weight: 3, blockingImpact: "DARF em aberto impede a CND Federal.", applicability: { regimes: PROFIT_REGIMES }, officialLinks: [OFFICIAL_LINKS.ecac], glossaryTermId: "lucro-presumido", description: "Tributos federais do mês/trimestre.", dueDay: 25 }),
  doc({ code: "GUIA_INSS", label: "INSS (DCTFWeb/DARF previdenciário) pago", group: "GUIAS", scope: "FEDERAL", authority: "Receita Federal", recurrence: "MONTHLY", defaultValidityDays: null, weight: 3, blockingImpact: "Impede a CND Federal.", applicability: { regimes: NOT_MEI }, officialLinks: [OFFICIAL_LINKS.ecac], glossaryTermId: "pro-labore", description: "INSS de pró-labore e folha.", dueDay: 20 }),
  doc({ code: "GUIA_FGTS", label: "FGTS Digital (GFD) pago", group: "GUIAS", scope: "TRABALHISTA", authority: "Ministério do Trabalho / Caixa", recurrence: "MONTHLY", defaultValidityDays: null, weight: 3, blockingImpact: "Impede o CRF do FGTS.", applicability: { requiresEmployees: true }, officialLinks: [OFFICIAL_LINKS.fgtsDigital], glossaryTermId: "crf-fgts", description: "Depósito mensal de 8% da folha.", dueDay: 20 }),
  doc({ code: "GUIA_ICMS", label: "DAR/DAE de ICMS pago (SEFAZ-PI)", group: "GUIAS", scope: "ESTADUAL", authority: "SEFAZ-PI", recurrence: "MONTHLY", defaultValidityDays: null, weight: 3, blockingImpact: "Impede a CND Estadual.", applicability: { regimes: PROFIT_REGIMES, requiresIcms: true }, officialLinks: [OFFICIAL_LINKS.sefazPi], glossaryTermId: "icms", description: "ICMS apurado no mês.", dueDay: 15 }),
  doc({ code: "GUIA_ISS", label: "ISS pago (Prefeitura)", group: "GUIAS", scope: "MUNICIPAL", authority: "SEMF Teresina", recurrence: "MONTHLY", defaultValidityDays: null, weight: 3, blockingImpact: "Impede a CND Municipal.", applicability: { regimes: PROFIT_REGIMES, requiresIss: true }, officialLinks: [OFFICIAL_LINKS.semfTeresina], glossaryTermId: "iss", description: "ISS das notas de serviço do mês.", dueDay: 15 }),
  // ── Trabalhista
  doc({ code: "FOLHA_CONTRACHEQUES", label: "Folha e contracheques do mês", group: "TRABALHISTA", scope: "TRABALHISTA", authority: "Empresa", recurrence: "MONTHLY", defaultValidityDays: null, weight: 2, blockingImpact: null, applicability: { requiresEmployees: true }, officialLinks: [OFFICIAL_LINKS.esocial], glossaryTermId: null, description: "Holerites assinados.", dueDay: 5 }),
  doc({ code: "PGR_PCMSO", label: "PGR e PCMSO (saúde e segurança)", group: "TRABALHISTA", scope: "TRABALHISTA", authority: "Ministério do Trabalho", recurrence: "PER_VALIDITY", defaultValidityDays: 730, weight: 2, blockingImpact: "Exigidos em fiscalização trabalhista.", applicability: { requiresEmployees: true }, officialLinks: [], glossaryTermId: null, description: "Programas de gerenciamento de riscos e de saúde ocupacional." }),
  // ── Notas do mês
  doc({ code: "NOTAS_EMITIDAS_MES", label: "Notas fiscais emitidas no mês", group: "NOTAS", scope: "FISCAL_CONTABIL", authority: "Empresa", recurrence: "MONTHLY", defaultValidityDays: null, weight: 3, blockingImpact: "Receita sem nota é sonegação e distorce o DAS.", applicability: {}, officialLinks: [OFFICIAL_LINKS.nfseNacional], glossaryTermId: null, description: "Todas as receitas do mês com nota anexada.", dueDay: 5 }),
  doc({ code: "NOTAS_ENTRADA_MES", label: "Notas de entrada do mês (compras)", group: "NOTAS", scope: "FISCAL_CONTABIL", authority: "Empresa", recurrence: "MONTHLY", defaultValidityDays: null, weight: 2, blockingImpact: "Despesa sem nota = crédito de IBS/CBS perdido.", applicability: {}, officialLinks: [OFFICIAL_LINKS.nfePortal], glossaryTermId: "credito-nao-cumulativo", description: "Despesas pagas no mês com nota anexada.", dueDay: 5 }),
  // ── LGPD
  doc({ code: "LGPD_POLITICA", label: "Política de privacidade e registro de tratamento (LGPD)", group: "LGPD", scope: "FEDERAL", authority: "ANPD", recurrence: "ONE_TIME", defaultValidityDays: null, weight: 1, blockingImpact: null, applicability: { isOptInOnly: true }, officialLinks: [], glossaryTermId: null, description: "Recomendado para quem trata dados de clientes." }),
];

const TYPES_BY_CODE = new Map(COMPANY_DOCUMENT_TYPES.map((documentType) => [documentType.code, documentType]));

export function findDocumentType(typeCode: string): CompanyDocumentType | undefined {
  return TYPES_BY_CODE.get(typeCode);
}

export interface ApplicabilityProfile {
  regime: TaxRegimeCode;
  hasEmployees: boolean;
  isIcmsContributor: boolean;
  isIssContributor: boolean;
}

export interface RequirementOverride {
  typeCode: string;
  isApplicable: boolean | null;
  weight: number | null;
  defaultValidityDays: number | null;
}

export function isDocumentApplicable(
  documentType: CompanyDocumentType,
  profile: ApplicabilityProfile,
  override?: RequirementOverride,
): boolean {
  if (override && override.isApplicable !== null) return override.isApplicable;
  const rule = documentType.applicability;
  if (rule.isOptInOnly) return false;
  if (rule.regimes && !rule.regimes.includes(profile.regime)) return false;
  if (rule.requiresEmployees && !profile.hasEmployees) return false;
  if (rule.requiresIcms && !profile.isIcmsContributor) return false;
  if (rule.requiresIss && !profile.isIssContributor) return false;
  return true;
}
