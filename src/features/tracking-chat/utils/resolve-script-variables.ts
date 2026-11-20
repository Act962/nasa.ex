export interface ScriptVariableValues {
  leadName?: string | null;
  leadPhone?: string | null;
  responsibleName?: string | null;
}

/** Troca as variáveis do script ({{nome_cliente}} etc.); variável sem valor fica como está. */
export function resolveScriptVariables(content: string, values: ScriptVariableValues): string {
  const today = new Date().toLocaleDateString("pt-BR");
  return content
    .replace(/\{\{nome_cliente\}\}/g, values.leadName ?? "{{nome_cliente}}")
    .replace(/\{\{telefone\}\}/g, values.leadPhone ?? "{{telefone}}")
    .replace(/\{\{data_hoje\}\}/g, today)
    .replace(/\{\{responsavel\}\}/g, values.responsibleName ?? "{{responsavel}}");
}
