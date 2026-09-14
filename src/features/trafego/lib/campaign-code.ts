/**
 * O código do pedido no nome da campanha é o que liga o painel do cliente aos
 * números reais — sem ninguém colar ID.
 *
 * Convenção combinada com a equipe: `TG-0007 — Padaria do Bairro — Leads`.
 * Uma campanha por código; o cron recusa vincular quando há ambiguidade.
 */

const ORDER_CODE_PATTERN = /\bTG-(\d{4,6})\b/gi;

/** Todos os códigos citados num nome. Mais de um = ambíguo, não vincula. */
export function extractOrderCodes(name: string): string[] {
  const matches = name.matchAll(ORDER_CODE_PATTERN);
  const codes = new Set<string>();
  for (const match of matches) codes.add(`TG-${match[1]}`);
  return [...codes];
}

/** Nome sugerido para a equipe criar a campanha no Meta. */
export function suggestCampaignName(params: {
  code: string;
  businessName?: string | null;
  objectiveLabel?: string | null;
}): string {
  return [params.code, params.businessName, params.objectiveLabel]
    .filter(Boolean)
    .join(" — ");
}
