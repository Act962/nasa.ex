import "server-only";
import prisma from "@/lib/prisma";

// Uso de IA de uma empresa agrupado por dia (horário de Brasília), provedor, modelo e origem da chave,
// a partir de `usage_event` (spec 0093, RF-7). O agrupamento é feito no banco para não trazer linha
// por linha: uma empresa grande tem dezenas de milhares de usos por mês.

export interface AiDailyUsageRow {
  /** Dia em Brasília, no formato AAAA-MM-DD. */
  day: string;
  provider: string | null;
  modelId: string | null;
  usingCustomKey: boolean;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** Custo gravado no evento; `null` quando nenhuma linha do grupo tinha preço. */
  costBrl: number | null;
  stars: number;
}

interface RawDailyUsageRow {
  day: string;
  provider: string | null;
  model_id: string | null;
  using_custom_key: boolean;
  calls: bigint;
  input_tokens: bigint | null;
  output_tokens: bigint | null;
  cost_brl: unknown;
  stars: bigint | null;
}

export async function loadAiDailyUsage(organizationId: string, since: Date, until?: Date): Promise<AiDailyUsageRow[]> {
  const upperBound = until ?? new Date();
  const rawRows = await prisma.$queryRaw<RawDailyUsageRow[]>`
    SELECT
      to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day,
      provider,
      model_id,
      using_custom_key,
      COUNT(*) AS calls,
      SUM(input_tokens) AS input_tokens,
      SUM(output_tokens) AS output_tokens,
      SUM(cost_brl) AS cost_brl,
      SUM(stars_charged) AS stars
    FROM usage_event
    WHERE organization_id = ${organizationId}
      AND created_at >= ${since}
      AND created_at < ${upperBound}
    GROUP BY 1, 2, 3, 4
    ORDER BY 1
  `;
  return rawRows.map((rawRow) => ({
    day: rawRow.day,
    provider: rawRow.provider,
    modelId: rawRow.model_id,
    usingCustomKey: rawRow.using_custom_key,
    calls: Number(rawRow.calls),
    inputTokens: Number(rawRow.input_tokens ?? 0),
    outputTokens: Number(rawRow.output_tokens ?? 0),
    costBrl: rawRow.cost_brl === null ? null : Number(rawRow.cost_brl),
    stars: Number(rawRow.stars ?? 0),
  }));
}
