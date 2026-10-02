/**
 * Paleta categórica dos gráficos (decisão D-2 do design system): tons do azul do ASTRO via
 * `--chart-*`, que trocam sozinhos entre claro e escuro. Da 6ª série em diante, os mesmos tons mais leves.
 */
export const CHART_PALETTE = [
  "var(--chart-3)",
  "var(--chart-1)",
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--chart-5)",
  "color-mix(in oklch, var(--chart-3) 55%, transparent)",
  "color-mix(in oklch, var(--chart-1) 55%, transparent)",
  "color-mix(in oklch, var(--chart-4) 55%, transparent)",
  "color-mix(in oklch, var(--chart-2) 55%, transparent)",
  "color-mix(in oklch, var(--chart-5) 55%, transparent)",
];

/** Fatia "Outros" e séries sem destaque. */
export const CHART_MUTED_FILL = "var(--muted-foreground)";
