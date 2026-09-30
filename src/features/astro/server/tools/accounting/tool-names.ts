// Nomes das tools contábeis do ASTRO (spec 0051, RF-17). Sem "server-only":
// a persona do Commander e o catálogo da aba Ações também leem esta lista.

export const ACCOUNTING_TOOL_NAMES = [
  "get_accounting_overview",
  "explain_fiscal_term",
  "get_tax_profile",
  "simulate_das",
  "simulate_cbs_ibs",
  "run_calculator",
  "list_tax_assessments",
  "list_obligations_due",
  "list_available_credits",
  "list_credit_suppliers",
  "list_expenses_without_nf",
  "get_regularity_score",
  "list_missing_documents",
  "list_expiring_documents",
  "list_company_documents",
  "diagnose_pricing",
  "get_ledger_summary",
  "get_reform_timeline",
  "list_tax_rates",
  "get_accounting_section_link",
] as const;

export type AccountingToolName = (typeof ACCOUNTING_TOOL_NAMES)[number];

const ACCOUNTING_TOOL_NAME_SET = new Set<string>(ACCOUNTING_TOOL_NAMES);

export function isAccountingToolName(toolName: string): boolean {
  return ACCOUNTING_TOOL_NAME_SET.has(toolName);
}
