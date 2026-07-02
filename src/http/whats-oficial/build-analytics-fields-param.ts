/**
 * Monta o valor do parâmetro `fields` usado pelos endpoints de analytics da
 * Graph API (`GET /{waba_id}?fields=analytics.start(...).end(...)...`). Os
 * filtros (`start`, `end`, `granularity`, `dimensions`) são "dot params"
 * dentro do próprio valor de `fields`, não query params separados.
 */
export function buildAnalyticsFieldsParam(
  metric: "analytics" | "conversation_analytics",
  params: {
    startUnix: number;
    endUnix: number;
    granularity: string;
    dimensions?: string[];
  },
): string {
  const dotParams = [
    `start(${params.startUnix})`,
    `end(${params.endUnix})`,
    `granularity(${params.granularity})`,
  ];

  if (params.dimensions?.length) {
    const dimensionsList = params.dimensions
      .map((dimension) => `"${dimension}"`)
      .join(",");
    dotParams.push(`dimensions([${dimensionsList}])`);
  }

  return `${metric}.${dotParams.join(".")}`;
}
