"use client";

import type { AdMetrics } from "@/features/trafego/lib/order-ads-metrics";
import { TechnicalTerm, type TechnicalTermKey } from "../../technical-term";
import { formatMoneyFromCents } from "../account-performance-sections";

type MetricFormat = "money" | "int" | "pct" | "decimal";

export interface MetricDefinition {
  key: keyof AdMetrics;
  label: string;
  format: MetricFormat;
  term?: TechnicalTermKey;
}

/** Ordem dos números na visão da campanha (spec 0126, RF-2): o que o cliente pergunta primeiro vem antes. */
export const AD_METRICS: MetricDefinition[] = [
  { key: "spendCents", label: "Investido", format: "money" },
  { key: "conversations", label: "Conversas", format: "int", term: "conversation" },
  { key: "costPerConversationCents", label: "Custo por conversa", format: "money", term: "costPerConversation" },
  { key: "ctr", label: "CTR", format: "pct", term: "ctr" },
  { key: "conversationRate", label: "Taxa de conversa", format: "pct", term: "conversationRate" },
  { key: "cpcCents", label: "CPC", format: "money", term: "cpc" },
  { key: "cpmCents", label: "CPM", format: "money", term: "cpm" },
  { key: "reach", label: "Alcance", format: "int", term: "reach" },
  { key: "impressions", label: "Impressões", format: "int", term: "impression" },
  { key: "clicks", label: "Cliques", format: "int", term: "click" },
  { key: "frequency", label: "Frequência", format: "decimal", term: "frequency" },
];

const COST_RATIO_KEYS = new Set<keyof AdMetrics>(["costPerConversationCents", "cpcCents", "cpmCents"]);

export function formatMetric(metrics: AdMetrics, definition: MetricDefinition, currency: string): string {
  const value = metrics[definition.key];
  // Custo sem a base (nenhuma conversa, clique ou impressão) não é custo zero: não houve o que custar.
  if (COST_RATIO_KEYS.has(definition.key) && value <= 0) return "—";
  if (definition.format === "money") return formatMoneyFromCents(value, currency);
  if (definition.format === "pct") return `${value.toFixed(2).replace(".", ",")}%`;
  if (definition.format === "decimal") return value.toFixed(2).replace(".", ",");
  return Math.round(value).toLocaleString("pt-BR");
}

export function MetricsGrid({
  metrics,
  currency,
  definitions = AD_METRICS,
}: {
  metrics: AdMetrics;
  currency: string;
  definitions?: MetricDefinition[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
      {definitions.map((definition) => (
        <div key={definition.key} className="min-w-0 rounded-[18px] border bg-card px-3.5 py-3">
          <p className="flex items-center text-[12px] text-muted-foreground">
            {definition.label}
            {definition.term && <TechnicalTerm term={definition.term} />}
          </p>
          <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">
            {formatMetric(metrics, definition, currency)}
          </p>
        </div>
      ))}
    </div>
  );
}
