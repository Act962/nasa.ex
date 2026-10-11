"use client";

import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { KEY_RULE_LABEL, type AiKeyRule } from "@/features/ia/lib/ai-resources";
import { MODEL_GUIDE_BY_ID } from "@/features/ia/lib/ai-model-guide";
import { formatBrl } from "@/features/ia/lib/format-brl";
import { cn } from "@/lib/utils";
import type { AiOverview, AiOverviewRow } from "./ai-company-panel";

// Lista completa dos recursos de IA (spec 0093, RF-6): modelo, de qual chave sai, quem paga e o uso.

const KEY_SOURCE_LABEL: Record<string, string> = {
  company: "Sua chave",
  funnel: "Chave do funil",
  planner: "Chave do Planner",
  platform: "Chave da plataforma",
  free: "Gratuito",
  none: "Sem chave",
};
const PAYER_LABEL: Record<string, string> = { company: "A empresa, direto ao provedor", platform: "Plataforma, cobrado em Stars", nobody: "Sem custo" };
const PROVIDER_LABEL: Record<string, string> = { openai: "OpenAI", google: "Gemini", anthropic: "Anthropic", other: "" };

function ResourceRow({ row }: { row: AiOverviewRow }) {
  const guide = row.modelId ? MODEL_GUIDE_BY_ID.get(row.modelId) : undefined;
  const providerLabel = row.provider ? PROVIDER_LABEL[row.provider] : "";
  const keyLabel = `${KEY_SOURCE_LABEL[row.keySource]}${providerLabel ? ` · ${providerLabel}` : ""}${row.keyLast4 ? ` · final ${row.keyLast4}` : ""}`;
  return (
    <div className={cn("grid gap-x-4 gap-y-1 border-t px-5 py-3 text-sm md:grid-cols-[1.4fr_1fr_1.1fr_0.9fr]", !row.followsRule && "bg-warning/5")}>
      <div className="min-w-0">
        <p className="font-medium">
          {row.label}
          {row.trackingName && <span className="font-normal text-muted-foreground"> · {row.trackingName}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{row.description}</p>
      </div>
      <div className="min-w-0">
        <p className="truncate" title={row.modelId ?? undefined}>
          {guide?.name ?? row.modelId ?? "—"}
        </p>
        {guide && <p className="text-xs text-muted-foreground">{guide.oneLine}</p>}
      </div>
      <div className="min-w-0">
        <p className={cn("truncate", row.keySource === "none" && "text-destructive")}>{keyLabel}</p>
        <p className="text-xs text-muted-foreground">{PAYER_LABEL[row.payer]}</p>
      </div>
      <div className="text-xs text-muted-foreground md:text-right">
        {row.usage.calls === 0 ? (
          "Sem uso no período"
        ) : (
          <>
            <p className="text-sm text-foreground">{row.usage.calls.toLocaleString("pt-BR")} usos</p>
            <p>
              {formatBrl(row.usage.costBrl)}
              {row.usage.unpricedCalls > 0 ? " (parcial)" : ""} · {row.usage.stars.toLocaleString("pt-BR")} Stars
            </p>
          </>
        )}
      </div>
      {row.note && (
        <p className="flex items-start gap-1.5 text-xs text-warning md:col-span-4">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          {row.note}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground md:col-span-4">
        Regra de hoje: {KEY_RULE_LABEL[row.keyRule as AiKeyRule]}.
        {row.settingsPlace === "funnel" && row.trackingId && (
          <Link href={`/tracking/${row.trackingId}/settings?tab=chatbot-ia&iaTab=model`} className="ml-1 font-medium text-primary hover:underline">
            Configurar neste funil
          </Link>
        )}
      </p>
    </div>
  );
}

export function AiResourceTable({ overview }: { overview: AiOverview }) {
  const rowsByApp = new Map<string, AiOverviewRow[]>();
  for (const row of overview.rows) rowsByApp.set(row.app, [...(rowsByApp.get(row.app) ?? []), row]);
  return (
    <div>
      {[...rowsByApp.entries()].map(([app, rows]) => (
        <div key={app}>
          <p className="border-t bg-muted/40 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{app}</p>
          {rows.map((row) => (
            <ResourceRow key={`${row.resourceId}:${row.trackingId ?? ""}`} row={row} />
          ))}
        </div>
      ))}
      {overview.unassignedUsage.calls > 0 && (
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          Outros usos sem recurso identificado: {overview.unassignedUsage.calls.toLocaleString("pt-BR")} · {formatBrl(overview.unassignedUsage.costBrl)} ·{" "}
          {overview.unassignedUsage.stars.toLocaleString("pt-BR")} Stars.
        </p>
      )}
    </div>
  );
}
