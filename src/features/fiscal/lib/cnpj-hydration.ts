// Traduz dados da CNPJ.ws para os enums usados no perfil fiscal (NFE.io) e é a
// fonte única das opções de Natureza Jurídica exibidas no formulário.

// Cada natureza jurídica: valor do enum LegalNature da NFE.io, rótulo exibido e
// o(s) código(s) da Tabela de Natureza Jurídica da Receita Federal (2021) que
// hidratam esse valor a partir da consulta de CNPJ.
type LegalNatureEntry = {
  value: string;
  label: string;
  receitaCodes: string[];
};

const LEGAL_NATURES: LegalNatureEntry[] = [
  // Mais comuns entre prestadores de serviço primeiro.
  { value: "Empresario", label: "Empresário Individual", receitaCodes: ["2135"] },
  {
    value: "SociedadeEmpresariaLimitada",
    label: "Sociedade Empresária Limitada (LTDA)",
    receitaCodes: ["2062"],
  },
  {
    value: "SociedadeSimplesLimitada",
    label: "Sociedade Simples Limitada",
    receitaCodes: ["2240"],
  },
  {
    value: "SociedadeUnipessoaldeAdvogados",
    label: "Sociedade Unipessoal de Advocacia",
    receitaCodes: ["2321"],
  },
  {
    value: "EireliNaturezaEmpresaria",
    label: "EIRELI (natureza empresária)",
    receitaCodes: ["2305"],
  },
  {
    value: "EireliNaturezaSimples",
    label: "EIRELI (natureza simples)",
    receitaCodes: ["2313"],
  },
  {
    value: "SociedadeSimplesPura",
    label: "Sociedade Simples Pura",
    receitaCodes: ["2232"],
  },
  {
    value: "SociedadeAnonimaFechada",
    label: "Sociedade Anônima Fechada",
    receitaCodes: ["2054"],
  },
  {
    value: "SociedadeAnonimaAberta",
    label: "Sociedade Anônima Aberta",
    receitaCodes: ["2046"],
  },
  { value: "Cooperativa", label: "Cooperativa", receitaCodes: ["2143"] },
  {
    value: "CooperativaDeConsumo",
    label: "Cooperativa de Consumo",
    receitaCodes: ["2330"],
  },
  {
    value: "EmpresaIndividualImobiliaria",
    label: "Empresa Individual Imobiliária",
    receitaCodes: ["4014"],
  },
  {
    value: "EmpresaSimplesDeInovacao",
    label: "Empresa Simples de Inovação (Inova Simples)",
    receitaCodes: ["2338"],
  },
  {
    value: "SociedadeEmpresariaEmNomeColetivo",
    label: "Sociedade Empresária em Nome Coletivo",
    receitaCodes: ["2070"],
  },
  {
    value: "SociedadeEmpresariaEmComanditaSimples",
    label: "Sociedade Empresária em Comandita Simples",
    receitaCodes: ["2089"],
  },
  {
    value: "SociedadeEmpresariaEmComanditaporAcoes",
    label: "Sociedade Empresária em Comandita por Ações",
    receitaCodes: ["2097"],
  },
  {
    value: "SociedadeSimplesEmNomeColetivo",
    label: "Sociedade Simples em Nome Coletivo",
    receitaCodes: ["2259"],
  },
  {
    value: "SociedadeSimplesEmComanditaSimples",
    label: "Sociedade Simples em Comandita Simples",
    receitaCodes: ["2267"],
  },
  {
    value: "SociedadeemContaParticipacao",
    label: "Sociedade em Conta de Participação",
    receitaCodes: ["2119"],
  },
  {
    value: "ConsorcioSociedades",
    label: "Consórcio de Sociedades",
    receitaCodes: ["2151"],
  },
  {
    value: "GrupoSociedades",
    label: "Grupo de Sociedades",
    receitaCodes: ["2160"],
  },
  {
    value: "EmpresaPublica",
    label: "Empresa Pública",
    receitaCodes: ["2011"],
  },
  {
    value: "SociedadeEconomiaMista",
    label: "Sociedade de Economia Mista",
    receitaCodes: ["2038"],
  },
  {
    value: "ServicoNotarial",
    label: "Serviço Notarial e Registral (Cartório)",
    receitaCodes: ["3034"],
  },
  {
    value: "ServicoSocialAutonomo",
    label: "Serviço Social Autônomo",
    receitaCodes: ["3077"],
  },
  {
    value: "CondominioEdilicio",
    label: "Condomínio Edilício",
    receitaCodes: ["3085"],
  },
  {
    value: "OrganizacaoReligiosa",
    label: "Organização Religiosa",
    receitaCodes: ["3220"],
  },
  { value: "FundacaoPrivada", label: "Fundação Privada", receitaCodes: ["3069"] },
  { value: "FundoPrivado", label: "Fundo Privado", receitaCodes: ["3247"] },
  {
    value: "AssociacaoPrivada",
    label: "Associação Privada",
    receitaCodes: ["3999"],
  },
  {
    value: "EntidadeSindical",
    label: "Entidade Sindical",
    receitaCodes: ["3131"],
  },
  { value: "ProdutorRural", label: "Produtor Rural", receitaCodes: ["4124"] },
  { value: "Leiloeiro", label: "Leiloeiro", receitaCodes: ["4111"] },
];

// Opções exibidas no <Select> de Natureza Jurídica (fonte única).
export const LEGAL_NATURE_OPTIONS = LEGAL_NATURES.map(({ value, label }) => ({
  value,
  label,
}));

const LEGAL_NATURE_BY_RECEITA_CODE: Record<string, string> = Object.fromEntries(
  LEGAL_NATURES.flatMap((entry) =>
    entry.receitaCodes.map((code) => [code, entry.value]),
  ),
);

export function resolveLegalNatureFromReceitaCode(
  code: string | number | null | undefined,
): string | null {
  if (code === null || code === undefined) return null;
  const normalizedCode = String(code).replace(/\D/g, "");
  return LEGAL_NATURE_BY_RECEITA_CODE[normalizedCode] ?? null;
}

// Extrai o CNAE (7 dígitos) da atividade principal para hidratar o perfil.
// Municípios que exigem 9 dígitos (ex.: Teresina) precisam do complemento manual.
export function resolveCnaeFromAtividadePrincipal(
  atividadePrincipal: { id: string } | null | undefined,
): string | null {
  if (!atividadePrincipal?.id) return null;
  const digits = atividadePrincipal.id.replace(/\D/g, "");
  return digits.length === 7 ? digits : null;
}

// Deriva o regime tributário do enquadramento no Simples/MEI. A CNPJ.ws pública
// não retorna `regime_tributario` (null) e não distingue Lucro Presumido de Real —
// então, fora do Simples/MEI, assume Lucro Presumido (mais comum entre prestadores)
// como default editável em vez de deixar o campo vazio. Só retorna null quando não
// há sequer o bloco `simples` para inferir.
export function resolveTaxRegimeFromSimples(
  simples: { simples: "Sim" | "Não" | null; mei: "Sim" | "Não" | null } | null,
): string {
  if (simples?.mei === "Sim") return "MicroempreendedorIndividual";
  if (simples?.simples === "Sim") return "SimplesNacional";
  // Sem Simples/MEI (ou sem o bloco simples), a CNPJ.ws pública não distingue
  // Presumido/Real — assume Lucro Presumido (default editável) para nunca deixar
  // o campo vazio.
  return "LucroPresumido";
}
