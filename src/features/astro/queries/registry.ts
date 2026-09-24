import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  WRITE_VERB,
  normalizeQuestion,
  type AstroQuery,
  type AstroQueryResult,
} from "./types";
import { TRACKING_QUERIES } from "./tracking";
import { AGENDA_QUERIES } from "./agenda";
import { APP_QUERIES } from "./apps";
import { INSIGHTS_QUERIES } from "./insights";
import { canAstroRead } from "@/features/astro/actions/permission-gate";

export type { AstroQuery, AstroQueryResult } from "./types";

/**
 * Ordem importa: a primeira que casa responde. As mais específicas vêm
 * antes das genéricas — "leads sem responsável" precisa ser testada antes
 * de "quantos leads".
 */
export const ASTRO_QUERIES: AstroQuery[] = [
  // Insights antes do tracking: "quantos leads com a tag X" é relatório, e
  // a contagem genérica de leads casaria primeiro.
  ...INSIGHTS_QUERIES,
  ...TRACKING_QUERIES,
  ...AGENDA_QUERIES,
  ...APP_QUERIES,
];

export async function runAstroQuery(params: {
  ctx: AgentContext;
  text: string;
  /** Turnos anteriores — "me manda a lista deles" só existe com eles. */
  history?: string[];
}): Promise<{ key: string; result: AstroQueryResult } | null> {
  const text = normalizeQuestion(params.text);
  // Ordem não é consulta. Sem isto, "lança 500 a receber" casava com o resumo
  // financeiro e devolvia relatório em vez de lançar.
  if (WRITE_VERB.test(text)) return null;
  const history = normalizeQuestion((params.history ?? []).slice(-4).join(" "));
  for (const query of ASTRO_QUERIES) {
    if (!query.matches(text, history)) continue;
    // Casou a frase, mas ainda não pode ver: a consulta nem roda, e o pedido
    // segue o caminho normal — onde as tools do orquestrador têm o próprio
    // gate — em vez de devolver número que a tela esconderia.
    if (!(await canAstroRead(params.ctx, query.appKey))) continue;
    const result = await query.run({ ctx: params.ctx, text, history });
    if (result) return { key: query.key, result };
  }
  return null;
}
