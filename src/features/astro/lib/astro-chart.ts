/**
 * Payloads de gráfico renderizáveis pelo Astro.
 *
 * Quando uma tool quer mostrar dados visualmente (insights), retorna
 * `{ kind: "astro_chart", chartType, ... }`. O `astro-message.tsx`
 * detecta via `isAstroChartPayload` e renderiza um <AstroChartCard>
 * (recharts).
 *
 * Tipos suportados — espelha o que /insights usa:
 *   - "bar"  → ranking, categorias (top atendentes, leads por status…)
 *   - "line" → tendência temporal (crescimento mensal de leads, etc)
 *   - "pie"  → distribuição percentual (propostas por status, etc)
 *
 * Shape dos dados:
 *   data: [{ label: "Mai", value: 12 }, ...]
 *
 * Multi-séries (ex: "ganhos" vs "perdidos" lado a lado por mês) é
 * possível adicionando `series: ["ganhos", "perdidos"]` e cada row
 * tendo as duas chaves. Por enquanto MVP é single-series.
 */

export type AstroChartType = "bar" | "line" | "pie";

export interface AstroChartDataPoint {
  label: string;
  value: number;
}

export interface AstroChartPayload {
  kind: "astro_chart";
  chartType: AstroChartType;
  title: string;
  caption?: string;
  /** Texto do eixo X (bar/line) ou descrição da fatia (pie). */
  xLabel?: string;
  /** Texto do eixo Y (bar/line). */
  yLabel?: string;
  data: AstroChartDataPoint[];
  /**
   * Se for "currency", o valor é tratado como centavos e formatado
   * como R$ no tooltip. "number" formata com toLocaleString. "percent"
   * (0-100) adiciona "%".
   */
  valueFormat?: "number" | "currency" | "percent";
}

export function isAstroChartPayload(value: unknown): value is AstroChartPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { kind?: string; data?: unknown };
  return v.kind === "astro_chart" && Array.isArray(v.data);
}

/**
 * Paleta dos gráficos: tons do azul do ASTRO (`--chart-1..5`, decisão D-2 do Design System)
 * e as cores de estado para séries extras. Cicla quando há mais de N fatias.
 */
export const ASTRO_CHART_COLORS = [
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--success)",
  "var(--warning)",
  "var(--destructive)",
];

export function chartColor(i: number): string {
  return ASTRO_CHART_COLORS[i % ASTRO_CHART_COLORS.length]!;
}

export function formatChartValue(
  value: number,
  fmt: AstroChartPayload["valueFormat"],
): string {
  if (fmt === "currency") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  }
  if (fmt === "percent") {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }
  return value.toLocaleString("pt-BR");
}
