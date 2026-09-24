import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { normalizeQuestion, type AstroQuery, type AstroQueryResult } from "./types";
import { TRACKING_QUERIES } from "./tracking";
import { AGENDA_QUERIES } from "./agenda";
import { APP_QUERIES } from "./apps";

export type { AstroQuery, AstroQueryResult } from "./types";

/**
 * Ordem importa: a primeira que casa responde. As mais específicas vêm
 * antes das genéricas — "leads sem responsável" precisa ser testada antes
 * de "quantos leads".
 */
export const ASTRO_QUERIES: AstroQuery[] = [
  ...TRACKING_QUERIES,
  ...AGENDA_QUERIES,
  ...APP_QUERIES,
];

export async function runAstroQuery(params: {
  ctx: AgentContext;
  text: string;
}): Promise<{ key: string; result: AstroQueryResult } | null> {
  const normalized = normalizeQuestion(params.text);
  for (const query of ASTRO_QUERIES) {
    if (!query.matches(normalized)) continue;
    const result = await query.run(params.ctx);
    if (result) return { key: query.key, result };
  }
  return null;
}
