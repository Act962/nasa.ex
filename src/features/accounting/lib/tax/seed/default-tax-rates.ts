import type { TaxKindCode, TaxRegimeCode } from "../types";

// Tabelas globais provisionadas em `TaxRate` (organizationId = null). O motor
// lê só do banco; este arquivo é a origem do seed idempotente (por `seedKey`).
// Linhas com `needsVerification` estão marcadas [VERIFICAR] na spec 0051 e
// aparecem com aviso na interface até alguém confirmar na fonte oficial.

export interface DefaultTaxRateSeed {
  seedKey: string;
  tax: TaxKindCode;
  regime: TaxRegimeCode | null;
  annex: string | null;
  bracket: number | null;
  revenueFromCents: number | null;
  revenueToCents: number | null;
  rateBps: number;
  deductionCents: number | null;
  fixedAmountCents: number | null;
  municipioIbge: string | null;
  reductionBps: number | null;
  validFrom: string;
  validTo: string | null;
  legalSource: string;
  note: string | null;
  needsVerification: boolean;
}

const SIMPLES_SOURCE = "LC 123/2006, Anexos I a V (redação da LC 155/2016)";
const SIMPLES_VALID_FROM = "2018-01-01";

// [faixa, receita até (R$), alíquota nominal (bps), parcela a deduzir (R$)]
type SimplesBracket = [number, number, number, number];

const SIMPLES_TABLES: Record<string, SimplesBracket[]> = {
  I: [
    [1, 180_000, 400, 0],
    [2, 360_000, 730, 5_940],
    [3, 720_000, 950, 13_860],
    [4, 1_800_000, 1070, 22_500],
    [5, 3_600_000, 1430, 87_300],
    [6, 4_800_000, 1900, 378_000],
  ],
  II: [
    [1, 180_000, 450, 0],
    [2, 360_000, 780, 5_940],
    [3, 720_000, 1000, 13_860],
    [4, 1_800_000, 1120, 22_500],
    [5, 3_600_000, 1470, 85_500],
    [6, 4_800_000, 3000, 720_000],
  ],
  III: [
    [1, 180_000, 600, 0],
    [2, 360_000, 1120, 9_360],
    [3, 720_000, 1350, 17_640],
    [4, 1_800_000, 1600, 35_640],
    [5, 3_600_000, 2100, 125_640],
    [6, 4_800_000, 3300, 648_000],
  ],
  IV: [
    [1, 180_000, 450, 0],
    [2, 360_000, 900, 8_100],
    [3, 720_000, 1020, 12_420],
    [4, 1_800_000, 1400, 39_780],
    [5, 3_600_000, 2200, 183_780],
    [6, 4_800_000, 3300, 828_000],
  ],
  V: [
    [1, 180_000, 1550, 0],
    [2, 360_000, 1800, 4_500],
    [3, 720_000, 1950, 9_900],
    [4, 1_800_000, 2050, 17_100],
    [5, 3_600_000, 2300, 62_100],
    [6, 4_800_000, 3050, 540_000],
  ],
};

function buildSimplesRows(): DefaultTaxRateSeed[] {
  const rows: DefaultTaxRateSeed[] = [];
  for (const [annex, brackets] of Object.entries(SIMPLES_TABLES)) {
    let previousLimitReais = 0;
    for (const [bracket, limitReais, rateBps, deductionReais] of brackets) {
      rows.push({
        seedKey: `simples-${annex}-${bracket}-2018`,
        tax: "DAS",
        regime: "SIMPLES",
        annex,
        bracket,
        revenueFromCents: previousLimitReais * 100 + (previousLimitReais === 0 ? 0 : 1),
        revenueToCents: limitReais * 100,
        rateBps,
        deductionCents: deductionReais * 100,
        fixedAmountCents: null,
        municipioIbge: null,
        reductionBps: null,
        validFrom: SIMPLES_VALID_FROM,
        validTo: null,
        legalSource: `${SIMPLES_SOURCE} — Anexo ${annex}`,
        note: null,
        needsVerification: false,
      });
      previousLimitReais = limitReais;
    }
  }
  return rows;
}

// Salário mínimo de 2026 usado no DAS do MEI (5% de INSS + ICMS R$ 1 + ISS R$ 5).
const MINIMUM_WAGE_2026_CENTS = 162_100;

function buildMeiRows(): DefaultTaxRateSeed[] {
  const inssCents = Math.round(MINIMUM_WAGE_2026_CENTS * 0.05);
  const activities: Array<[string, number]> = [
    ["COMERCIO_INDUSTRIA", inssCents + 100],
    ["SERVICOS", inssCents + 500],
    ["COMERCIO_SERVICOS", inssCents + 600],
  ];
  return activities.map(([annex, totalCents]) => ({
    seedKey: `mei-${annex}-2026`,
    tax: "DAS_MEI" as const,
    regime: "MEI" as const,
    annex,
    bracket: null,
    revenueFromCents: null,
    revenueToCents: 8_100_000,
    rateBps: 500,
    deductionCents: null,
    fixedAmountCents: totalCents,
    municipioIbge: null,
    reductionBps: null,
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    legalSource: "LC 123/2006, art. 18-A §3º; salário mínimo 2026",
    note: "5% do salário mínimo (INSS) + ICMS R$ 1,00 e/ou ISS R$ 5,00. Limite anual R$ 81 mil.",
    needsVerification: true,
  }));
}

function presumidoRow(
  seedKey: string,
  tax: TaxKindCode,
  annex: string | null,
  rateBps: number,
  legalSource: string,
  note: string | null,
  extra: Partial<DefaultTaxRateSeed> = {},
): DefaultTaxRateSeed {
  return {
    seedKey,
    tax,
    regime: "PRESUMIDO",
    annex,
    bracket: null,
    revenueFromCents: null,
    revenueToCents: null,
    rateBps,
    deductionCents: null,
    fixedAmountCents: null,
    municipioIbge: null,
    reductionBps: null,
    validFrom: "2015-01-01",
    validTo: null,
    legalSource,
    note,
    needsVerification: false,
    ...extra,
  };
}

function buildPresumidoRows(): DefaultTaxRateSeed[] {
  return [
    presumidoRow("presumido-irpj-15", "IRPJ", "ALIQUOTA", 1500, "Lei 9.249/1995, art. 3º", "15% sobre a base presumida"),
    presumidoRow(
      "presumido-irpj-adicional",
      "IRPJ",
      "ADICIONAL",
      1000,
      "Lei 9.249/1995, art. 3º §1º",
      "Adicional de 10% sobre a base que exceder R$ 60 mil no trimestre",
      { deductionCents: 6_000_000 },
    ),
    presumidoRow("presumido-csll-9", "CSLL", "ALIQUOTA", 900, "Lei 7.689/1988, art. 3º", "9% sobre a base presumida"),
    presumidoRow("presumido-pis-cumulativo", "PIS", "CUMULATIVO", 65, "Lei 9.715/1998", "PIS cumulativo 0,65% (extinto em 2027 pela LC 214/2025)", { validTo: "2026-12-31" }),
    presumidoRow("presumido-cofins-cumulativo", "COFINS", "CUMULATIVO", 300, "Lei 9.718/1998", "COFINS cumulativa 3% (extinta em 2027 pela LC 214/2025)", { validTo: "2026-12-31" }),
  ];
}

function buildRealRows(): DefaultTaxRateSeed[] {
  return [
    { ...presumidoRow("real-pis-nao-cumulativo", "PIS", "NAO_CUMULATIVO", 165, "Lei 10.637/2002", "PIS não cumulativo 1,65%", { validTo: "2026-12-31" }), regime: "REAL" },
    { ...presumidoRow("real-cofins-nao-cumulativo", "COFINS", "NAO_CUMULATIVO", 760, "Lei 10.833/2003", "COFINS não cumulativa 7,6%", { validTo: "2026-12-31" }), regime: "REAL" },
  ];
}

function buildIssRows(): DefaultTaxRateSeed[] {
  return [
    {
      seedKey: "iss-teresina-geral",
      tax: "ISS",
      regime: null,
      annex: null,
      bracket: null,
      revenueFromCents: null,
      revenueToCents: null,
      rateBps: 500,
      deductionCents: null,
      fixedAmountCents: null,
      municipioIbge: "2211001",
      reductionBps: null,
      validFrom: "2018-01-01",
      validTo: "2032-12-31",
      legalSource: "Código Tributário de Teresina — alíquota geral do ISSQN",
      note: "Alíquota geral; vários itens da LC 116 têm alíquota menor (2% a 5%). Confirme a do seu serviço.",
      needsVerification: true,
    },
    {
      seedKey: "iss-padrao-maximo",
      tax: "ISS",
      regime: null,
      annex: null,
      bracket: null,
      revenueFromCents: null,
      revenueToCents: null,
      rateBps: 500,
      deductionCents: null,
      fixedAmountCents: null,
      municipioIbge: null,
      reductionBps: null,
      validFrom: "2003-08-01",
      validTo: "2032-12-31",
      legalSource: "LC 116/2003, art. 8º (máximo 5%) e art. 8º-A (mínimo 2%)",
      note: "Padrão usado quando o município não está cadastrado.",
      needsVerification: false,
    },
  ];
}

// Transição da Reforma (EC 132/2023 e LC 214/2025). A alíquota de referência
// plena ainda será fixada pelo Senado: os valores de 2027 em diante são
// ESTIMATIVAS oficiais do Ministério da Fazenda e vão marcados para revisão.
const CBS_REFERENCE_ESTIMATE_BPS = 880;
const IBS_REFERENCE_ESTIMATE_BPS = 1770;

function reformRow(
  seedKey: string,
  tax: TaxKindCode,
  rateBps: number,
  validFrom: string,
  validTo: string | null,
  note: string,
  needsVerification: boolean,
  reductionBps: number | null = null,
): DefaultTaxRateSeed {
  return {
    seedKey,
    tax,
    regime: null,
    annex: tax === "ISS" || tax === "ICMS" ? "TRANSICAO" : null,
    bracket: null,
    revenueFromCents: null,
    revenueToCents: null,
    rateBps,
    deductionCents: null,
    fixedAmountCents: null,
    municipioIbge: null,
    reductionBps,
    validFrom,
    validTo,
    legalSource: "EC 132/2023; LC 214/2025 (arts. 343 a 346 — transição)",
    note,
    needsVerification,
  };
}

function buildReformRows(): DefaultTaxRateSeed[] {
  const rows: DefaultTaxRateSeed[] = [
    reformRow("reforma-cbs-2026", "CBS", 90, "2026-01-01", "2026-12-31", "Ano-teste: 0,9% destacado na nota, compensável com PIS/COFINS.", false),
    reformRow("reforma-ibs-2026", "IBS", 10, "2026-01-01", "2026-12-31", "Ano-teste: 0,1% (0,05% estadual + 0,05% municipal).", false),
    reformRow("reforma-cbs-2027", "CBS", CBS_REFERENCE_ESTIMATE_BPS, "2027-01-01", null, "CBS plena; PIS/COFINS extintos. Alíquota de referência estimada.", true),
    reformRow("reforma-ibs-2027", "IBS", 10, "2027-01-01", "2028-12-31", "IBS segue em 0,1% em 2027 e 2028.", false),
  ];

  const ibsPhaseIn: Array<[number, number]> = [
    [2029, 1000],
    [2030, 2000],
    [2031, 3000],
    [2032, 4000],
  ];
  for (const [year, shareBps] of ibsPhaseIn) {
    rows.push(
      reformRow(
        `reforma-ibs-${year}`,
        "IBS",
        Math.round((IBS_REFERENCE_ESTIMATE_BPS * shareBps) / 10000),
        `${year}-01-01`,
        `${year}-12-31`,
        `IBS em ${shareBps / 100}% da alíquota de referência (estimada).`,
        true,
      ),
    );
    // ICMS e ISS caem para 90/80/70/60% do que seriam. reductionBps = parcela que SOBRA.
    const remainingBps = 10000 - shareBps;
    rows.push(reformRow(`reforma-iss-fator-${year}`, "ISS", 0, `${year}-01-01`, `${year}-12-31`, `ISS reduzido a ${remainingBps / 100}% em ${year}.`, false, remainingBps));
    rows.push(reformRow(`reforma-icms-fator-${year}`, "ICMS", 0, `${year}-01-01`, `${year}-12-31`, `ICMS reduzido a ${remainingBps / 100}% em ${year}.`, false, remainingBps));
  }
  rows.push(reformRow("reforma-ibs-2033", "IBS", IBS_REFERENCE_ESTIMATE_BPS, "2033-01-01", null, "IBS pleno; ICMS e ISS extintos. Alíquota de referência estimada.", true));
  rows.push(reformRow("reforma-iss-fator-2033", "ISS", 0, "2033-01-01", null, "ISS extinto.", false, 0));
  rows.push(reformRow("reforma-icms-fator-2033", "ICMS", 0, "2033-01-01", null, "ICMS extinto.", false, 0));
  return rows;
}

function buildPayrollRows(): DefaultTaxRateSeed[] {
  const base = {
    regime: null,
    bracket: null,
    revenueFromCents: null,
    deductionCents: null,
    fixedAmountCents: null,
    municipioIbge: null,
    reductionBps: null,
  } as const;

  // Tabela progressiva mensal do IRRF (vigente desde mai/2025) + redutor da
  // Lei 15.270/2025 (isenção até R$ 5 mil a partir de 2026).
  const irrfBrackets: Array<[number, number | null, number, number]> = [
    [1, 242_880, 0, 0],
    [2, 282_665, 750, 18_216],
    [3, 375_105, 1500, 39_416],
    [4, 466_468, 2250, 67_549],
    [5, null, 2750, 90_873],
  ];
  const irrfRows: DefaultTaxRateSeed[] = irrfBrackets.map(([bracket, limitCents, rateBps, deductionCents]) => ({
    ...base,
    seedKey: `irrf-mensal-${bracket}-2025`,
    tax: "IRRF",
    annex: "TABELA_MENSAL",
    bracket,
    revenueToCents: limitCents,
    rateBps,
    deductionCents,
    validFrom: "2025-05-01",
    validTo: null,
    legalSource: "Lei 15.191/2025 — tabela progressiva mensal do IRPF",
    note: null,
    needsVerification: true,
  }));

  return [
    ...irrfRows,
    {
      ...base,
      seedKey: "irrf-redutor-2026",
      tax: "IRRF",
      annex: "REDUTOR_2026",
      revenueToCents: 735_000,
      rateBps: 0,
      // Isenção até R$ 5 mil; acima disso, redução = deductionCents − rendimento × reductionBps.
      // reductionBps aqui está em MILIONÉSIMOS (133145 = 13,3145%), a precisão que a lei usa.
      fixedAmountCents: 500_000,
      deductionCents: 97_862,
      reductionBps: 133_145,
      validFrom: "2026-01-01",
      validTo: null,
      legalSource: "Lei 15.270/2025 — isenção até R$ 5.000 e redução gradual até R$ 7.350",
      note: "Redução = R$ 978,62 − 13,3145% × rendimento, entre R$ 5.000,01 e R$ 7.350.",
      needsVerification: true,
    },
    {
      ...base,
      seedKey: "irrf-retencao-servicos",
      tax: "IRRF",
      annex: "RETENCAO_SERVICOS",
      revenueToCents: null,
      rateBps: 150,
      validFrom: "2004-01-01",
      validTo: null,
      legalSource: "RIR/2018 (Decreto 9.580), art. 714",
      note: "Retenção de 1,5% sobre serviços profissionais pagos por PJ.",
      needsVerification: false,
    },
    {
      ...base,
      seedKey: "csrf-retencao",
      tax: "PIS",
      annex: "CSRF",
      revenueToCents: null,
      rateBps: 465,
      validFrom: "2004-02-01",
      validTo: "2026-12-31",
      legalSource: "Lei 10.833/2003, art. 30 (PIS 0,65% + COFINS 3% + CSLL 1%)",
      note: "Retenção conjunta de 4,65%.",
      needsVerification: false,
    },
    {
      ...base,
      seedKey: "inss-retencao-cessao",
      tax: "INSS",
      annex: "RETENCAO_CESSAO",
      revenueToCents: null,
      rateBps: 1100,
      validFrom: "1999-02-01",
      validTo: null,
      legalSource: "Lei 8.212/1991, art. 31",
      note: "Retenção de 11% na cessão de mão de obra/empreitada.",
      needsVerification: false,
    },
    {
      ...base,
      seedKey: "inss-contribuinte-individual-2026",
      tax: "INSS",
      annex: "PRO_LABORE",
      revenueToCents: 847_555,
      rateBps: 1100,
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      legalSource: "Lei 8.212/1991, art. 21 — contribuinte individual (pró-labore)",
      note: "11% até o teto do INSS de 2026.",
      needsVerification: true,
    },
    {
      ...base,
      seedKey: "inss-patronal-20",
      tax: "INSS",
      annex: "PATRONAL",
      revenueToCents: null,
      rateBps: 2000,
      validFrom: "1991-07-01",
      validTo: null,
      legalSource: "Lei 8.212/1991, art. 22, I",
      note: "Cota patronal (fora do Simples, e no Simples Anexo IV). Somar RAT (1–3%) e terceiros (~5,8%).",
      needsVerification: false,
    },
    {
      ...base,
      seedKey: "fgts-8",
      tax: "FGTS",
      annex: null,
      revenueToCents: null,
      rateBps: 800,
      validFrom: "1990-05-11",
      validTo: null,
      legalSource: "Lei 8.036/1990, art. 15",
      note: "Depósito mensal de 8% (recolhido pelo FGTS Digital desde mar/2024).",
      needsVerification: false,
    },
  ];
}

export const DEFAULT_TAX_RATES: DefaultTaxRateSeed[] = [
  ...buildSimplesRows(),
  ...buildMeiRows(),
  ...buildPresumidoRows(),
  ...buildRealRows(),
  ...buildIssRows(),
  ...buildReformRows(),
  ...buildPayrollRows(),
];

/** seedKeys que a interface deve marcar como "confirmar na fonte oficial". */
export const TAX_RATE_SEED_KEYS_TO_VERIFY = new Set(
  DEFAULT_TAX_RATES.filter((row) => row.needsVerification).map((row) => row.seedKey),
);

export const DEFAULT_TAX_RATES_VERSION = "2026-09-29.1";
