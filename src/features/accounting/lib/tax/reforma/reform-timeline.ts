import type { TaxRegimeCode } from "../types";

// Linha do tempo da Reforma Tributária (EC 132/2023 e LC 214/2025) mostrada na
// subaba "Reforma". Conteúdo em dados para o ASTRO e a interface dizerem o
// mesmo. Revisar quando sair regulamentação nova.

export interface ReformMilestone {
  year: number;
  title: string;
  summary: string;
  changes: string[];
  actionsByRegime: Partial<Record<TaxRegimeCode | "TODOS", string[]>>;
  legalSource: string;
}

export const REFORM_TIMELINE: ReformMilestone[] = [
  {
    year: 2026,
    title: "Ano-teste",
    summary: "CBS de 0,9% e IBS de 0,1% aparecem destacados nas notas, sem pagamento efetivo.",
    changes: [
      "Notas fiscais (NF-e, NFC-e, NFS-e) ganham os campos de IBS/CBS e o código cClassTrib.",
      "O valor destacado pode ser compensado com PIS/COFINS; quem cumpre as obrigações acessórias fica dispensado de recolher.",
      "NFS-e passa a seguir o padrão nacional (Emissor Nacional/ADN).",
      "Empresas do Simples e MEI ficam fora do destaque em 2026.",
    ],
    actionsByRegime: {
      TODOS: [
        "Classificar produtos e serviços (NCM/NBS + cClassTrib).",
        "Confirmar com a emissora de notas que o layout novo está ativo.",
      ],
      PRESUMIDO: ["Conferir se o sistema emissor destaca CBS/IBS corretamente."],
      REAL: ["Conferir se o sistema emissor destaca CBS/IBS corretamente."],
    },
    legalSource: "LC 214/2025, arts. 343 a 346",
  },
  {
    year: 2027,
    title: "CBS plena",
    summary: "PIS e COFINS acabam. A CBS entra com alíquota cheia e o Imposto Seletivo começa.",
    changes: [
      "PIS/COFINS extintos; IPI zerado (exceto Zona Franca de Manaus).",
      "CBS com alíquota de referência (estimada em ~8,8%).",
      "IBS continua em 0,1% em 2027 e 2028.",
      "Simples pode optar por recolher IBS/CBS por fora do DAS para transferir crédito cheio ao cliente PJ.",
    ],
    actionsByRegime: {
      SIMPLES: ["Decidir a opção 'por dentro x por fora' com o comparativo da calculadora."],
      PRESUMIDO: ["Revisar preços: a CBS é não cumulativa e gera crédito nas compras."],
      REAL: ["Migrar créditos de PIS/COFINS acumulados conforme as regras de transição."],
    },
    legalSource: "EC 132/2023; LC 214/2025",
  },
  {
    year: 2029,
    title: "IBS começa a substituir ICMS e ISS",
    summary: "ICMS e ISS caem para 90% e o IBS sobe para 10% da alíquota de referência.",
    changes: [
      "2029: ICMS/ISS a 90%; 2030: 80%; 2031: 70%; 2032: 60%.",
      "IBS cresce na mesma proporção.",
    ],
    actionsByRegime: { TODOS: ["Acompanhar a carga mês a mês no simulador de transição."] },
    legalSource: "LC 214/2025, arts. 343 a 346",
  },
  {
    year: 2033,
    title: "Modelo novo completo",
    summary: "ICMS e ISS deixam de existir. Ficam CBS, IBS e o Imposto Seletivo.",
    changes: ["IBS com alíquota de referência plena (estimada em ~17,7%).", "Split payment generalizado."],
    actionsByRegime: { TODOS: ["Revisar precificação e cadastro fiscal completo."] },
    legalSource: "EC 132/2023, art. 125 do ADCT",
  },
];
