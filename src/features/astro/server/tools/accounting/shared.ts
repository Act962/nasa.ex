import "server-only";
import prisma from "@/lib/prisma";
import { toMonthKey } from "@/features/accounting/lib/format";
import type { CalculationResult } from "@/features/accounting/lib/tax/types";

// Formato comum das respostas de cálculo: a memória vai inteira para o ASTRO
// poder citar passo, fórmula e base legal sem recalcular nada.

export function toCalculationPayload(calculation: CalculationResult<unknown>) {
  return {
    result: calculation.output,
    steps: calculation.steps.map((step) => ({
      label: step.label,
      formula: step.formula ?? null,
      value: step.value,
      legalSource: step.legalSource ?? null,
      glossaryTermId: step.termId ?? null,
    })),
    warnings: calculation.warnings.map((warning) => warning.message),
    sources: calculation.sources,
  };
}

/** Perfil fiscal só para leitura: não cria o perfil se a empresa nunca abriu a aba. */
export function loadExistingTaxProfile(organizationId: string) {
  return prisma.organizationTaxProfile.findUnique({ where: { organizationId } });
}

export const PROFILE_MISSING_MESSAGE =
  "A empresa ainda não configurou o perfil fiscal. Peça para abrir /payment › Contábil › Perfil fiscal e preencher regime, CNAE e anexo — sem isso qualquer cálculo seria chute.";

export function currentMonthKey(): string {
  return toMonthKey(new Date());
}

export function toMonthMiddle(monthKey: string): Date {
  const [yearText, monthText] = monthKey.split("-");
  return new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 15, 12));
}
