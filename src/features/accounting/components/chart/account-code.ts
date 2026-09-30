import type { AccountingNatureCode } from "@/features/accounting/lib/chart-of-accounts/default-chart";

export const ACCOUNT_CODE_PATTERN = /^\d+(\.\d+)*$/;

export const NATURE_LABELS: Record<AccountingNatureCode, string> = {
  ASSET: "Ativo",
  LIABILITY: "Passivo",
  EQUITY: "PL",
  REVENUE: "Receita",
  COST: "Custo",
  EXPENSE: "Despesa",
};

export const NATURE_DESCRIPTIONS: Record<AccountingNatureCode, string> = {
  ASSET: "Ativo — o que a empresa tem (caixa, banco, clientes a receber, bens)",
  LIABILITY: "Passivo — o que a empresa deve (fornecedores, impostos, empréstimos)",
  EQUITY: "Patrimônio líquido — o que é dos sócios",
  REVENUE: "Receita — o que entra pelas vendas",
  COST: "Custo — o que se gasta para produzir/entregar",
  EXPENSE: "Despesa — gastos para manter a empresa funcionando",
};

export const NATURE_BADGE_CLASSES: Record<AccountingNatureCode, string> = {
  ASSET: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  LIABILITY: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  EQUITY: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  REVENUE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  COST: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  EXPENSE: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

/** Profundidade na árvore: "1" → 0, "1.1.01" → 2. */
export function accountDepth(code: string): number {
  return code.split(".").length - 1;
}

/** Ordena por segmento numérico ("1.2" antes de "1.10"). */
export function compareAccountCodes(firstCode: string, secondCode: string): number {
  const firstSegments = firstCode.split(".").map(Number);
  const secondSegments = secondCode.split(".").map(Number);
  const length = Math.max(firstSegments.length, secondSegments.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (firstSegments[index] ?? -1) - (secondSegments[index] ?? -1);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
