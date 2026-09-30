export type AccountingNatureCode = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "COST" | "EXPENSE";

export interface DefaultAccount {
  code: string;
  name: string;
  nature: AccountingNatureCode;
  isAnalytical: boolean;
  systemKey?: string;
}

/** Contas que o motor usa sem precisar de mapeamento manual. */
export const SYSTEM_ACCOUNT_KEYS = {
  cash: "cash",
  bankDefault: "bank_default",
  customersReceivable: "customers_receivable",
  suppliersPayable: "suppliers_payable",
  cbsRecoverable: "cbs_recoverable",
  ibsRecoverable: "ibs_recoverable",
  taxPayable: "tax_payable",
  revenueDefault: "revenue_default",
  costDefault: "cost_default",
  expenseDefault: "expense_default",
  taxExpense: "tax_expense",
  retainedEarnings: "retained_earnings",
} as const;

export type SystemAccountKey = (typeof SYSTEM_ACCOUNT_KEYS)[keyof typeof SYSTEM_ACCOUNT_KEYS];

function synthetic(code: string, name: string, nature: AccountingNatureCode): DefaultAccount {
  return { code, name, nature, isAnalytical: false };
}

function analytical(code: string, name: string, nature: AccountingNatureCode, systemKey?: SystemAccountKey): DefaultAccount {
  return { code, name, nature, isAnalytical: true, systemKey };
}

// Plano enxuto para PME, compatível em estrutura com o referencial do SPED.
// O código hierárquico define o pai (1.1.01.001 → 1.1.01).
export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccount[] = [
  synthetic("1", "Ativo", "ASSET"),
  synthetic("1.1", "Ativo circulante", "ASSET"),
  synthetic("1.1.01", "Disponível", "ASSET"),
  analytical("1.1.01.001", "Caixa", "ASSET", SYSTEM_ACCOUNT_KEYS.cash),
  analytical("1.1.01.002", "Bancos conta movimento", "ASSET", SYSTEM_ACCOUNT_KEYS.bankDefault),
  synthetic("1.1.02", "Clientes", "ASSET"),
  analytical("1.1.02.001", "Clientes a receber", "ASSET", SYSTEM_ACCOUNT_KEYS.customersReceivable),
  synthetic("1.1.03", "Tributos a recuperar", "ASSET"),
  analytical("1.1.03.001", "CBS a recuperar", "ASSET", SYSTEM_ACCOUNT_KEYS.cbsRecoverable),
  analytical("1.1.03.002", "IBS a recuperar", "ASSET", SYSTEM_ACCOUNT_KEYS.ibsRecoverable),
  analytical("1.1.03.003", "PIS/COFINS a recuperar", "ASSET"),
  synthetic("1.2", "Ativo não circulante", "ASSET"),
  synthetic("1.2.01", "Imobilizado", "ASSET"),
  analytical("1.2.01.001", "Máquinas e equipamentos", "ASSET"),
  analytical("1.2.01.002", "Computadores e periféricos", "ASSET"),
  analytical("1.2.01.003", "Móveis e utensílios", "ASSET"),
  analytical("1.2.01.009", "(−) Depreciação acumulada", "ASSET"),

  synthetic("2", "Passivo", "LIABILITY"),
  synthetic("2.1", "Passivo circulante", "LIABILITY"),
  synthetic("2.1.01", "Fornecedores", "LIABILITY"),
  analytical("2.1.01.001", "Fornecedores a pagar", "LIABILITY", SYSTEM_ACCOUNT_KEYS.suppliersPayable),
  synthetic("2.1.02", "Obrigações tributárias", "LIABILITY"),
  analytical("2.1.02.001", "Simples Nacional a recolher", "LIABILITY"),
  analytical("2.1.02.002", "IRPJ e CSLL a recolher", "LIABILITY"),
  analytical("2.1.02.003", "PIS e COFINS a recolher", "LIABILITY"),
  analytical("2.1.02.004", "ISS a recolher", "LIABILITY"),
  analytical("2.1.02.005", "ICMS a recolher", "LIABILITY"),
  analytical("2.1.02.006", "CBS e IBS a recolher", "LIABILITY"),
  analytical("2.1.02.009", "Outros tributos a recolher", "LIABILITY", SYSTEM_ACCOUNT_KEYS.taxPayable),
  synthetic("2.1.03", "Obrigações trabalhistas", "LIABILITY"),
  analytical("2.1.03.001", "Salários a pagar", "LIABILITY"),
  analytical("2.1.03.002", "Pró-labore a pagar", "LIABILITY"),
  analytical("2.1.03.003", "INSS a recolher", "LIABILITY"),
  analytical("2.1.03.004", "FGTS a recolher", "LIABILITY"),
  synthetic("2.1.04", "Outras obrigações", "LIABILITY"),
  analytical("2.1.04.001", "Empréstimos e financiamentos", "LIABILITY"),

  synthetic("3", "Patrimônio líquido", "EQUITY"),
  analytical("3.1.01", "Capital social", "EQUITY"),
  analytical("3.2.01", "Lucros ou prejuízos acumulados", "EQUITY", SYSTEM_ACCOUNT_KEYS.retainedEarnings),
  analytical("3.3.01", "Lucros distribuídos", "EQUITY"),

  synthetic("4", "Receitas", "REVENUE"),
  synthetic("4.1", "Receita operacional", "REVENUE"),
  analytical("4.1.01", "Receita de serviços", "REVENUE", SYSTEM_ACCOUNT_KEYS.revenueDefault),
  analytical("4.1.02", "Receita de venda de mercadorias", "REVENUE"),
  synthetic("4.3", "Outras receitas", "REVENUE"),
  analytical("4.3.01", "Receitas financeiras", "REVENUE"),

  synthetic("5", "Custos", "COST"),
  analytical("5.1.01", "Custo dos serviços prestados", "COST", SYSTEM_ACCOUNT_KEYS.costDefault),
  analytical("5.1.02", "Custo das mercadorias vendidas", "COST"),

  synthetic("6", "Despesas", "EXPENSE"),
  synthetic("6.1", "Despesas operacionais", "EXPENSE"),
  analytical("6.1.01", "Despesas administrativas", "EXPENSE", SYSTEM_ACCOUNT_KEYS.expenseDefault),
  analytical("6.1.02", "Despesas com pessoal", "EXPENSE"),
  analytical("6.1.03", "Despesas comerciais e marketing", "EXPENSE"),
  analytical("6.1.04", "Aluguel, energia e ocupação", "EXPENSE"),
  analytical("6.1.05", "Despesas tributárias (impostos)", "EXPENSE", SYSTEM_ACCOUNT_KEYS.taxExpense),
  analytical("6.1.06", "Despesas financeiras", "EXPENSE"),
  analytical("6.1.07", "Depreciação", "EXPENSE"),
];

export function resolveParentCode(code: string): string | null {
  const lastDot = code.lastIndexOf(".");
  return lastDot === -1 ? null : code.slice(0, lastDot);
}

/** Saldo natural: ativo, custo e despesa são devedores; o resto é credor. */
export function isDebitNature(nature: AccountingNatureCode): boolean {
  return nature === "ASSET" || nature === "COST" || nature === "EXPENSE";
}
