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
 * Paleta consistente — escolhida pra contrastar bem no fundo dark do
 * Explorer. Cicla quando há mais de N fatias.
 */
export const ASTRO_CHART_COLORS = [
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#ec4899", // pink-500
  "#3b82f6", // blue-500
  "#ef4444", // red-500
  "#84cc16", // lime-500
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
