import type { BroadcastTemplateParam } from "../schema/broadcast-schemas";

/**
 * Regras das variáveis `{{n}}` de um template de campanha, compartilhadas entre
 * a aba Modelo (client), o `setTemplate`, a checagem pré-disparo e o envio
 * (spec 0052).
 */

const PLACEHOLDER_PATTERN = /\{\{\s*(\d+)\s*\}\}/g;

/** Origens cujo `value` é o próprio conteúdo (ou a chave dele) — vazio não serve. */
export function isParamValueRequired(source: BroadcastTemplateParam["source"]): boolean {
  return source === "static" || source === "customField";
}

export function isParamIncomplete(param: BroadcastTemplateParam): boolean {
  return isParamValueRequired(param.source) && param.value.trim() === "";
}

/**
 * Problemas do mapa de variáveis do corpo frente ao número de `{{n}}` do
 * template. Lista vazia = pronto pra disparar.
 */
export function findTemplateMappingProblems(
  body: ReadonlyArray<BroadcastTemplateParam>,
  expectedVariableCount: number,
): string[] {
  const problems: string[] = [];

  if (body.length < expectedVariableCount) {
    problems.push(
      `O modelo tem ${expectedVariableCount} variável(is) no corpo, mas só ${body.length} foi(ram) configurada(s). Configure todas e salve o modelo.`,
    );
  }

  body.slice(0, expectedVariableCount).forEach((param, index) => {
    if (!isParamIncomplete(param)) return;
    problems.push(
      param.source === "static"
        ? `Preencha o texto fixo da variável {{${index + 1}}}.`
        : `Informe a coluna da planilha da variável {{${index + 1}}}.`,
    );
  });

  return problems;
}

export function countTemplatePlaceholders(text: string | null | undefined): number {
  if (!text) return 0;
  const matches = text.match(PLACEHOLDER_PATTERN);
  return matches ? new Set(matches.map((match) => match.replace(/\s/g, ""))).size : 0;
}

/** Substitui `{{n}}` pelos valores (posição n-1). Placeholder sem valor fica como está. */
export function renderTemplateText(text: string, values: ReadonlyArray<string>): string {
  return text.replace(PLACEHOLDER_PATTERN, (placeholder, position: string) => {
    const value = values[Number(position) - 1];
    return value?.trim() ? value : placeholder;
  });
}
