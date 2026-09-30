import { computeDas, SIMPLES_ANNEXES, type SimplesAnnex } from "../tax/simples/compute-das";
import { computeDasMei, MEI_ACTIVITIES, type MeiActivity } from "../tax/mei/compute-das-mei";
import { computeIrpjCsllPresumido, computeMonthlyContributions } from "../tax/presumido/compute-presumido";
import { computeCbsIbs, resolveLegacyTaxRemainingBps } from "../tax/reforma/compute-cbs-ibs";
import { computeMarkupPrice, computeRealMargin } from "../pricing/compute-pricing";
import { computeWithholdings } from "../tax/withholding/compute-withholdings";
import { computeEmployeeCost, computeProLabore } from "../tax/payroll/compute-payroll";
import { computeLatePayment } from "../tax/late-payment/compute-late-payment";
import { computeInterest, computeStraightLineDepreciation } from "../tax/utilities/compute-utilities";
import { compareRegimes } from "../tax/regime-comparison/compare-regimes";
import type { CalculationResult, TaxRateRow, TaxRegimeCode } from "../tax/types";
import { formatCentsBrl } from "../format";

// Registro único das calculadoras: a interface desenha os campos a partir
// daqui, o servidor executa daqui e o ASTRO usa o mesmo `runCalculator`. Uma
// fórmula nunca existe em dois lugares.

export type CalculatorFieldType = "money" | "percent" | "number" | "boolean" | "select" | "date";

export interface CalculatorField {
  name: string;
  label: string;
  type: CalculatorFieldType;
  termId?: string;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
  /** Chave do contexto (perfil fiscal/RBT12) que pré-preenche o campo. */
  prefillFrom?: keyof CalculatorContextDefaults;
  defaultValue?: number | string | boolean;
}

export interface CalculatorContextDefaults {
  rbt12Cents: number;
  payroll12mCents: number;
  simplesAnnex: string;
  isFatorRSubject: boolean;
  issRateBps: number;
  regime: TaxRegimeCode;
  ibsCbsOutsideSimples: boolean;
  commissionBps: number;
}

export type CalculatorValues = Record<string, number | string | boolean | undefined>;

export interface CalculatorRunContext {
  rates: TaxRateRow[];
  at: Date;
}

export type CalculatorGroup = "simples" | "presumido" | "reforma" | "precificacao" | "folha" | "retencoes" | "utilidades";

export interface CalculatorDefinition {
  id: string;
  title: string;
  description: string;
  group: CalculatorGroup;
  fields: CalculatorField[];
  run: (values: CalculatorValues, context: CalculatorRunContext) => CalculationResult<unknown>;
}

export const CALCULATOR_GROUP_LABELS: Record<CalculatorGroup, string> = {
  simples: "Simples Nacional e MEI",
  presumido: "Lucro Presumido e comparativos",
  reforma: "Reforma Tributária",
  precificacao: "Preço de venda",
  folha: "Folha e sócios",
  retencoes: "Retenções",
  utilidades: "Utilitárias",
};

function toCents(value: CalculatorValues[string]): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

function toBps(value: CalculatorValues[string]): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

function toBoolean(value: CalculatorValues[string]): boolean {
  return value === true || value === "true";
}

function toDate(value: CalculatorValues[string], fallback: Date): Date {
  if (typeof value !== "string" || value.length < 10) return fallback;
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

const ANNEX_OPTIONS = SIMPLES_ANNEXES.map((annex) => ({ value: annex, label: `Anexo ${annex}` }));

export const CALCULATORS: CalculatorDefinition[] = [
  {
    id: "das_simples",
    title: "DAS do mês (Simples Nacional)",
    description: "Alíquota efetiva pela faixa do RBT12 e valor do DAS. Aplica o Fator R quando marcado.",
    group: "simples",
    fields: [
      { name: "monthRevenueCents", label: "Receita do mês", type: "money", termId: "receita-bruta" },
      { name: "rbt12Cents", label: "RBT12", type: "money", termId: "rbt12", prefillFrom: "rbt12Cents" },
      { name: "annex", label: "Anexo", type: "select", options: ANNEX_OPTIONS, termId: "anexo-simples", prefillFrom: "simplesAnnex", defaultValue: "III" },
      { name: "isFatorRSubject", label: "Serviço sujeito ao Fator R", type: "boolean", termId: "fator-r", prefillFrom: "isFatorRSubject" },
      { name: "payroll12mCents", label: "Folha dos últimos 12 meses", type: "money", termId: "folha-12-meses", prefillFrom: "payroll12mCents" },
    ],
    run: (values, context) =>
      computeDas({
        rbt12Cents: toCents(values.rbt12Cents),
        monthRevenueByAnnex: { [String(values.annex ?? "III") as SimplesAnnex]: toCents(values.monthRevenueCents) },
        payroll12mCents: toCents(values.payroll12mCents),
        isFatorRSubject: toBoolean(values.isFatorRSubject),
        rates: context.rates,
        at: context.at,
      }),
  },
  {
    id: "fator_r",
    title: "Simulador de Fator R",
    description: "Quanto de folha (pró-labore) a empresa precisa para pagar pelo Anexo III em vez do V.",
    group: "simples",
    fields: [
      { name: "rbt12Cents", label: "RBT12", type: "money", termId: "rbt12", prefillFrom: "rbt12Cents" },
      { name: "payroll12mCents", label: "Folha atual dos últimos 12 meses", type: "money", termId: "folha-12-meses", prefillFrom: "payroll12mCents" },
      { name: "monthRevenueCents", label: "Receita do mês", type: "money" },
    ],
    run: (values, context) => {
      const rbt12Cents = toCents(values.rbt12Cents);
      const payroll12mCents = toCents(values.payroll12mCents);
      const monthRevenueCents = toCents(values.monthRevenueCents);
      const requiredPayrollCents = Math.ceil((rbt12Cents * 2800) / 10000);
      const missingPayrollCents = Math.max(0, requiredPayrollCents - payroll12mCents);
      const current = computeDas({
        rbt12Cents,
        monthRevenueByAnnex: { V: monthRevenueCents },
        payroll12mCents,
        isFatorRSubject: true,
        rates: context.rates,
        at: context.at,
      });
      const optimized = computeDas({
        rbt12Cents,
        monthRevenueByAnnex: { V: monthRevenueCents },
        payroll12mCents: Math.max(payroll12mCents, requiredPayrollCents),
        isFatorRSubject: true,
        rates: context.rates,
        at: context.at,
      });
      const savingCents = current.output.totalAmountCents - optimized.output.totalAmountCents;
      return {
        output: { requiredPayrollCents, missingPayrollCents, savingCents },
        steps: [
          ...current.steps.slice(0, 1),
          { label: "Folha mínima para 28%", formula: "RBT12 × 28%", value: formatCentsBrl(requiredPayrollCents), termId: "fator-r" },
          { label: "Falta de folha em 12 meses", value: formatCentsBrl(missingPayrollCents) },
          { label: "Pró-labore mensal extra aproximado", value: formatCentsBrl(Math.ceil(missingPayrollCents / 12)) },
          { label: "DAS do mês hoje", value: formatCentsBrl(current.output.totalAmountCents) },
          { label: "DAS do mês com Fator R ≥ 28%", value: formatCentsBrl(optimized.output.totalAmountCents) },
          { label: "Economia no mês (antes do INSS extra)", value: formatCentsBrl(savingCents) },
        ],
        warnings: [
          {
            code: "fator_r_cost",
            message: "Pró-labore extra tem INSS de 11% e pode ter IRRF: confira na calculadora de pró-labore se a economia compensa.",
          },
        ],
        sources: current.sources,
      };
    },
  },
  {
    id: "das_mei",
    title: "DAS do MEI",
    description: "Valor fixo mensal do MEI e alerta de limite anual.",
    group: "simples",
    fields: [
      {
        name: "activity",
        label: "Atividade",
        type: "select",
        options: MEI_ACTIVITIES.map((activity) => ({
          value: activity,
          label: activity === "COMERCIO_INDUSTRIA" ? "Comércio/Indústria" : activity === "SERVICOS" ? "Serviços" : "Comércio e Serviços",
        })),
        defaultValue: "SERVICOS",
        termId: "mei",
      },
      { name: "yearRevenueCents", label: "Receita acumulada no ano", type: "money" },
    ],
    run: (values, context) =>
      computeDasMei({
        activity: String(values.activity ?? "SERVICOS") as MeiActivity,
        yearRevenueCents: toCents(values.yearRevenueCents),
        rates: context.rates,
        at: context.at,
      }),
  },
  {
    id: "presumido_trimestre",
    title: "IRPJ e CSLL do trimestre (Presumido)",
    description: "Base presumida, IRPJ 15%, adicional de 10% e CSLL 9%.",
    group: "presumido",
    fields: [
      { name: "quarterRevenueCents", label: "Receita do trimestre", type: "money" },
      { name: "irpjBaseBps", label: "Presunção do IRPJ", type: "percent", defaultValue: 3200, termId: "lucro-presumido" },
      { name: "csllBaseBps", label: "Presunção da CSLL", type: "percent", defaultValue: 3200 },
    ],
    run: (values, context) =>
      computeIrpjCsllPresumido({
        quarterRevenueCents: toCents(values.quarterRevenueCents),
        irpjBaseBps: toBps(values.irpjBaseBps) || 3200,
        csllBaseBps: toBps(values.csllBaseBps) || 3200,
        rates: context.rates,
        at: context.at,
      }),
  },
  {
    id: "presumido_mensal",
    title: "PIS, COFINS e ISS do mês",
    description: "Contribuições mensais (cumulativo no Presumido, não cumulativo no Real) e ISS.",
    group: "presumido",
    fields: [
      { name: "monthRevenueCents", label: "Receita do mês", type: "money" },
      {
        name: "pisCofinsRegime",
        label: "Regime do PIS/COFINS",
        type: "select",
        options: [
          { value: "CUMULATIVO", label: "Cumulativo (Presumido)" },
          { value: "NAO_CUMULATIVO", label: "Não cumulativo (Real)" },
        ],
        defaultValue: "CUMULATIVO",
        termId: "pis-cofins",
      },
      { name: "pisCofinsCreditsCents", label: "Créditos de PIS/COFINS (só não cumulativo)", type: "money", termId: "credito-nao-cumulativo" },
      { name: "issRateBps", label: "Alíquota de ISS", type: "percent", prefillFrom: "issRateBps", termId: "iss" },
    ],
    run: (values, context) =>
      computeMonthlyContributions({
        monthRevenueCents: toCents(values.monthRevenueCents),
        pisCofinsRegime: values.pisCofinsRegime === "NAO_CUMULATIVO" ? "NAO_CUMULATIVO" : "CUMULATIVO",
        pisCofinsCreditsCents: toCents(values.pisCofinsCreditsCents),
        issRateBps: toBps(values.issRateBps),
        issRemainingBps: resolveLegacyTaxRemainingBps(context.rates, "ISS", context.at),
        rates: context.rates,
        at: context.at,
      }),
  },
  {
    id: "comparativo_regimes",
    title: "Comparativo de regimes",
    description: "Simples x Presumido x Real sobre faturamento e folha anuais.",
    group: "presumido",
    fields: [
      { name: "annualRevenueCents", label: "Faturamento anual", type: "money", prefillFrom: "rbt12Cents" },
      { name: "annualPayrollCents", label: "Folha anual (com pró-labore)", type: "money", prefillFrom: "payroll12mCents" },
      { name: "simplesAnnex", label: "Anexo no Simples", type: "select", options: ANNEX_OPTIONS, prefillFrom: "simplesAnnex", defaultValue: "III" },
      { name: "isFatorRSubject", label: "Sujeito ao Fator R", type: "boolean", prefillFrom: "isFatorRSubject" },
      { name: "issRateBps", label: "Alíquota de ISS", type: "percent", prefillFrom: "issRateBps", defaultValue: 500 },
      { name: "profitMarginBps", label: "Margem de lucro (Lucro Real)", type: "percent", defaultValue: 2000, termId: "lucro-real" },
      { name: "creditableCostsBps", label: "Custos que geram crédito (Lucro Real)", type: "percent", defaultValue: 2000 },
      { name: "patronalChargesBps", label: "Encargos patronais sobre a folha", type: "percent", defaultValue: 2680, hint: "20% + RAT 1% + terceiros 5,8%" },
    ],
    run: (values, context) =>
      compareRegimes({
        annualRevenueCents: toCents(values.annualRevenueCents),
        annualPayrollCents: toCents(values.annualPayrollCents),
        simplesAnnex: String(values.simplesAnnex ?? "III") as SimplesAnnex,
        isFatorRSubject: toBoolean(values.isFatorRSubject),
        issRateBps: toBps(values.issRateBps),
        profitMarginBps: toBps(values.profitMarginBps),
        creditableCostsBps: toBps(values.creditableCostsBps),
        patronalChargesBps: toBps(values.patronalChargesBps),
        rates: context.rates,
        at: context.at,
      }),
  },
  {
    id: "cbs_ibs",
    title: "CBS e IBS por ano da transição",
    description: "Débito sobre as vendas menos o crédito das compras, no ano escolhido (2026–2033).",
    group: "reforma",
    fields: [
      { name: "year", label: "Ano", type: "number", defaultValue: 2027 },
      { name: "revenueCents", label: "Receita do período", type: "money" },
      { name: "reductionBps", label: "Redução do regime diferenciado", type: "percent", termId: "cclasstrib", hint: "0%, 30%, 60% ou 100%" },
      { name: "cbsCreditsCents", label: "Créditos de CBS disponíveis", type: "money", termId: "credito-nao-cumulativo" },
      { name: "ibsCreditsCents", label: "Créditos de IBS disponíveis", type: "money" },
      {
        name: "regime",
        label: "Regime",
        type: "select",
        options: [
          { value: "SIMPLES", label: "Simples Nacional" },
          { value: "PRESUMIDO", label: "Lucro Presumido" },
          { value: "REAL", label: "Lucro Real" },
        ],
        prefillFrom: "regime",
      },
      { name: "ibsCbsOutsideSimples", label: "Simples recolhendo IBS/CBS por fora", type: "boolean", prefillFrom: "ibsCbsOutsideSimples", termId: "simples-por-fora" },
    ],
    run: (values, context) => {
      const year = typeof values.year === "number" ? values.year : context.at.getUTCFullYear();
      return computeCbsIbs({
        revenueCents: toCents(values.revenueCents),
        reductionBps: toBps(values.reductionBps),
        cbsCreditsCents: toCents(values.cbsCreditsCents),
        ibsCreditsCents: toCents(values.ibsCreditsCents),
        regime: (String(values.regime ?? "PRESUMIDO") as TaxRegimeCode),
        ibsCbsOutsideSimples: toBoolean(values.ibsCbsOutsideSimples),
        rates: context.rates,
        at: new Date(Date.UTC(year, 6, 1)),
      });
    },
  },
  {
    id: "markup",
    title: "Preço de venda (markup divisor)",
    description: "Preço que cobre custo, impostos, comissão e a margem que você quer.",
    group: "precificacao",
    fields: [
      { name: "unitCostCents", label: "Custo unitário", type: "money" },
      { name: "taxRateBps", label: "Impostos sobre a venda", type: "percent", termId: "aliquota-efetiva", hint: "Use a alíquota efetiva do seu perfil" },
      { name: "commissionBps", label: "Comissão", type: "percent", prefillFrom: "commissionBps" },
      { name: "otherVariableBps", label: "Outras despesas variáveis (cartão, frete)", type: "percent" },
      { name: "desiredMarginBps", label: "Margem líquida desejada", type: "percent", defaultValue: 1500, termId: "margem-liquida" },
    ],
    run: (values) =>
      computeMarkupPrice({
        unitCostCents: toCents(values.unitCostCents),
        taxRateBps: toBps(values.taxRateBps),
        commissionBps: toBps(values.commissionBps),
        otherVariableBps: toBps(values.otherVariableBps),
        desiredMarginBps: toBps(values.desiredMarginBps),
      }),
  },
  {
    id: "margem_real",
    title: "Margem real de um preço",
    description: "Quanto sobra de verdade de um preço já praticado.",
    group: "precificacao",
    fields: [
      { name: "priceCents", label: "Preço de venda", type: "money" },
      { name: "unitCostCents", label: "Custo unitário", type: "money" },
      { name: "taxRateBps", label: "Impostos", type: "percent", termId: "aliquota-efetiva" },
      { name: "commissionBps", label: "Comissão", type: "percent", prefillFrom: "commissionBps" },
      { name: "otherVariableBps", label: "Outras despesas variáveis", type: "percent" },
    ],
    run: (values) =>
      computeRealMargin({
        priceCents: toCents(values.priceCents),
        unitCostCents: toCents(values.unitCostCents),
        taxRateBps: toBps(values.taxRateBps),
        commissionBps: toBps(values.commissionBps),
        otherVariableBps: toBps(values.otherVariableBps),
      }),
  },
  {
    id: "retencoes",
    title: "Retenções na nota de serviço",
    description: "IRRF, PIS/COFINS/CSLL, INSS e ISS retidos, e o líquido a receber.",
    group: "retencoes",
    fields: [
      { name: "invoiceCents", label: "Valor da nota", type: "money" },
      { name: "withholdIrrf", label: "Reter IRRF 1,5%", type: "boolean", termId: "retencao-na-fonte" },
      { name: "withholdCsrf", label: "Reter PIS/COFINS/CSLL 4,65%", type: "boolean" },
      { name: "withholdInss", label: "Reter INSS 11% (cessão de mão de obra)", type: "boolean" },
      { name: "issWithheldRateBps", label: "ISS retido pelo tomador", type: "percent", termId: "iss" },
    ],
    run: (values, context) =>
      computeWithholdings({
        invoiceCents: toCents(values.invoiceCents),
        withholdIrrf: toBoolean(values.withholdIrrf),
        withholdCsrf: toBoolean(values.withholdCsrf),
        withholdInss: toBoolean(values.withholdInss),
        issWithheldRateBps: toBps(values.issWithheldRateBps),
        rates: context.rates,
        at: context.at,
      }),
  },
  {
    id: "pro_labore",
    title: "Pró-labore x distribuição de lucros",
    description: "INSS e IRRF do pró-labore, comparado à distribuição isenta.",
    group: "folha",
    fields: [
      { name: "proLaboreCents", label: "Pró-labore mensal", type: "money", termId: "pro-labore" },
      { name: "dependents", label: "Dependentes", type: "number", defaultValue: 0 },
    ],
    run: (values, context) =>
      computeProLabore({
        proLaboreCents: toCents(values.proLaboreCents),
        dependents: typeof values.dependents === "number" ? values.dependents : 0,
        rates: context.rates,
        at: context.at,
      }),
  },
  {
    id: "custo_funcionario",
    title: "Custo de um funcionário",
    description: "Salário + FGTS + INSS patronal + provisões de férias e 13º.",
    group: "folha",
    fields: [
      { name: "salaryCents", label: "Salário bruto", type: "money" },
      { name: "isPatronalInsideDas", label: "Empresa do Simples (Anexo I, II, III ou V)", type: "boolean", defaultValue: true },
      { name: "ratBps", label: "RAT", type: "percent", defaultValue: 100 },
      { name: "thirdPartiesBps", label: "Terceiros (Sistema S)", type: "percent", defaultValue: 580 },
    ],
    run: (values, context) =>
      computeEmployeeCost({
        salaryCents: toCents(values.salaryCents),
        isPatronalInsideDas: toBoolean(values.isPatronalInsideDas),
        ratBps: toBps(values.ratBps),
        thirdPartiesBps: toBps(values.thirdPartiesBps),
        rates: context.rates,
        at: context.at,
      }),
  },
  {
    id: "guia_atraso",
    title: "Guia federal em atraso",
    description: "Multa de 0,33% ao dia (teto 20%) + Selic acumulada + 1% no mês do pagamento.",
    group: "utilidades",
    fields: [
      { name: "principalCents", label: "Valor original da guia", type: "money" },
      { name: "dueDate", label: "Vencimento", type: "date" },
      { name: "paymentDate", label: "Data do pagamento", type: "date" },
      { name: "accumulatedSelicBps", label: "Selic acumulada no período", type: "percent", termId: "selic", hint: "Tabela de juros da Receita Federal" },
    ],
    run: (values, context) =>
      computeLatePayment({
        principalCents: toCents(values.principalCents),
        dueDate: toDate(values.dueDate, context.at),
        paymentDate: toDate(values.paymentDate, context.at),
        accumulatedSelicBps: toBps(values.accumulatedSelicBps),
      }),
  },
  {
    id: "depreciacao",
    title: "Depreciação linear",
    description: "Quanto um bem perde de valor por mês.",
    group: "utilidades",
    fields: [
      { name: "assetCostCents", label: "Custo do bem", type: "money", termId: "depreciacao" },
      { name: "residualValueCents", label: "Valor residual", type: "money" },
      { name: "usefulLifeMonths", label: "Vida útil (meses)", type: "number", defaultValue: 60 },
    ],
    run: (values) =>
      computeStraightLineDepreciation({
        assetCostCents: toCents(values.assetCostCents),
        residualValueCents: toCents(values.residualValueCents),
        usefulLifeMonths: typeof values.usefulLifeMonths === "number" ? values.usefulLifeMonths : 60,
      }),
  },
  {
    id: "juros",
    title: "Juros simples e compostos",
    description: "Valor futuro de uma dívida ou aplicação.",
    group: "utilidades",
    fields: [
      { name: "principalCents", label: "Valor inicial", type: "money" },
      { name: "monthlyRateBps", label: "Taxa ao mês", type: "percent" },
      { name: "months", label: "Meses", type: "number", defaultValue: 12 },
      { name: "isCompound", label: "Juros compostos", type: "boolean", defaultValue: true },
    ],
    run: (values) =>
      computeInterest({
        principalCents: toCents(values.principalCents),
        monthlyRateBps: toBps(values.monthlyRateBps),
        months: typeof values.months === "number" ? values.months : 12,
        isCompound: toBoolean(values.isCompound),
      }),
  },
];

const CALCULATORS_BY_ID = new Map(CALCULATORS.map((calculator) => [calculator.id, calculator]));

export function findCalculator(calculatorId: string): CalculatorDefinition | undefined {
  return CALCULATORS_BY_ID.get(calculatorId);
}

export function runCalculator(
  calculatorId: string,
  values: CalculatorValues,
  context: CalculatorRunContext,
): CalculationResult<unknown> | null {
  const calculator = findCalculator(calculatorId);
  if (!calculator) return null;
  return calculator.run(values, context);
}
