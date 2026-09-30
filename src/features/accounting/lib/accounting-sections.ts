// Mapa das subabas da aba Contábil (`/payment?tab=accounting&sub=<id>`). Mora
// em lib pura para o ASTRO (prompt e tool de navegação) descrever a mesma tela
// que o usuário vê.

export const ACCOUNTING_SECTION_IDS = [
  "overview",
  "documents",
  "profile",
  "assessments",
  "credits",
  "pricing",
  "calendar",
  "calculator",
  "chart",
  "reports",
  "reform",
] as const;

export type AccountingSectionKey = (typeof ACCOUNTING_SECTION_IDS)[number];

export interface AccountingSectionInfo {
  id: AccountingSectionKey;
  label: string;
  purpose: string;
}

export const ACCOUNTING_SECTIONS: Record<AccountingSectionKey, AccountingSectionInfo> = {
  overview: {
    id: "overview",
    label: "Visão geral",
    purpose: "Score de regularidade, pendências, próximas obrigações, guia do mês passado, créditos disponíveis e despesas pagas sem nota.",
  },
  documents: {
    id: "documents",
    label: "N-Box · Documentos",
    purpose: "Documentos da empresa (contrato social, cartão CNPJ, alvarás, certidões, certificado digital) com validade lida pela IA, cofre de senhas e o que falta para o score subir.",
  },
  profile: {
    id: "profile",
    label: "Perfil fiscal",
    purpose: "Regime tributário, CNAE, anexo do Simples, Fator R, folha de 12 meses, ISS/ICMS e a opção de IBS/CBS por fora do Simples. Base de todos os cálculos.",
  },
  assessments: {
    id: "assessments",
    label: "Apurações e guias",
    purpose: "Apurar o mês (rascunho com memória de cálculo) e confirmar: a guia vira conta a pagar em Despesas.",
  },
  credits: {
    id: "credits",
    label: "Créditos",
    purpose: "Créditos de IBS/CBS das notas de entrada, ranking de fornecedores e despesas pagas sem nota (crédito perdido).",
  },
  pricing: {
    id: "pricing",
    label: "Produtos & Preços",
    purpose: "Classificação tributária dos produtos do Forge (NCM/NBS, cClassTrib), alíquota efetiva no preço e propostas sem imposto calculado.",
  },
  calendar: {
    id: "calendar",
    label: "Calendário fiscal",
    purpose: "Guias e declarações do regime por vencimento, incluindo as atrasadas.",
  },
  calculator: {
    id: "calculator",
    label: "Calculadora",
    purpose: "Calculadoras com memória de cálculo: markup, margem, retenções, pró-labore, custo de funcionário, guia em atraso, comparativo de regimes.",
  },
  chart: {
    id: "chart",
    label: "Plano de contas",
    purpose: "Contas contábeis e o mapeamento de cada categoria do financeiro para uma conta.",
  },
  reports: {
    id: "reports",
    label: "Balancete e balanço",
    purpose: "Balancete, razão e balanço patrimonial gerados dos lançamentos do financeiro (partidas dobradas automáticas).",
  },
  reform: {
    id: "reform",
    label: "Reforma Tributária",
    purpose: "Linha do tempo 2026–2033 da CBS/IBS com o que muda em cada ano e o que fazer no regime da empresa.",
  },
};

export function buildAccountingSectionUrl(section: AccountingSectionKey): string {
  return section === "overview" ? "/payment?tab=accounting" : `/payment?tab=accounting&sub=${section}`;
}

export function isAccountingSectionKey(value: string): value is AccountingSectionKey {
  return (ACCOUNTING_SECTION_IDS as readonly string[]).includes(value);
}
