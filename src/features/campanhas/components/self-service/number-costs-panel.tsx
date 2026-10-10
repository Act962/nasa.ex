"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StarsPurchaseModal } from "@/features/stars/components/stars-purchase-modal";
import { cn } from "@/lib/utils";
import { useNumberCostEntries, useNumberCostSummary } from "../../hooks/use-official-number";

// Custos do número por conta do cliente, com histórico (spec 0087, Parte F).

type CostKind = "call" | "meta" | "chat" | "number";

const KIND_FILTERS: Array<{ kind: CostKind | null; label: string }> = [
  { kind: null, label: "Tudo" },
  { kind: "call", label: "Chamadas" },
  { kind: "meta", label: "Meta" },
  { kind: "chat", label: "Mensagens" },
  { kind: "number", label: "Número" },
];

const MONTHS_SHOWN = 4;

function recentMonths(): Array<{ value: string; label: string }> {
  const now = new Date();
  return Array.from({ length: MONTHS_SHOWN }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = index === 0 ? "Este mês" : date.toLocaleDateString("pt-BR", { month: "long" });
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
}

function formatStars(stars: number): string {
  return `${stars.toLocaleString("pt-BR")} ${stars === 1 ? "Star" : "Stars"}`;
}

function formatBrl(amount: number): string {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ChargedByTag({ chargedBy }: { chargedBy: "META" | "ORBITA" }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
      {chargedBy === "META" ? "Meta · seu cartão" : "Órbita · Stars"}
    </span>
  );
}

function CostRow({ title, detail, chargedBy, value }: { title: string; detail?: string; chargedBy: "META" | "ORBITA"; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t py-2.5 first:border-t-0">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {title}
          <ChargedByTag chargedBy={chargedBy} />
        </p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <p className="shrink-0 text-sm tabular-nums">{value}</p>
    </div>
  );
}

function downloadEntriesAsCsv(entries: Array<{ occurredAt: string; title: string; detail: string; chargedBy: string; stars: number | null; amountBrl: number | null }>, month: string) {
  const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [
    ["Data", "O quê", "Detalhe", "Cobrado por", "Stars", "Valor (R$)"].join(";"),
    ...entries.map((entry) =>
      [
        escapeCell(new Date(entry.occurredAt).toLocaleString("pt-BR")),
        escapeCell(entry.title),
        escapeCell(entry.detail),
        entry.chargedBy === "META" ? "Meta" : "Órbita",
        entry.stars ?? "",
        entry.amountBrl !== null ? entry.amountBrl.toFixed(2).replace(".", ",") : "",
      ].join(";"),
    ),
  ];
  const fileUrl = URL.createObjectURL(new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = fileUrl;
  link.download = `custos-do-numero-${month}.csv`;
  link.click();
  URL.revokeObjectURL(fileUrl);
}

export function NumberCostsPanel({ trackingId, className }: { trackingId: string; className?: string }) {
  const months = recentMonths();
  const [month, setMonth] = useState(months[0].value);
  const [kind, setKind] = useState<CostKind | null>(null);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const summary = useNumberCostSummary(trackingId, month);
  const history = useNumberCostEntries(trackingId, { month, kind: kind ?? undefined });

  if (summary.isLoading) return <Skeleton className={cn("h-48 w-full rounded-[22px]", className)} />;
  if (!summary.data) return null;
  const costs = summary.data;
  const entries = history.data?.entries ?? [];

  return (
    <div className={cn("space-y-4", className)}>
      {!costs.credit.hasCredit && (
        <div className="rounded-[22px] border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-semibold">Sem crédito para ligações e disparos</p>
          <p className="text-sm text-muted-foreground">
            Sua empresa está sem crédito (Stars). Recarregue para disparar campanhas e atender chamadas. As demais
            funções continuam disponíveis.
          </p>
          <Button size="sm" className="mt-3" onClick={() => setIsPurchaseOpen(true)}>
            Recarregar
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
        <div className="rounded-[22px] border bg-card p-4">
          <p className="text-sm font-medium">Crédito da empresa</p>
          <p className="my-1 text-2xl font-semibold tabular-nums">{formatStars(costs.credit.stars)}</p>
          <p className="text-xs text-muted-foreground">
            Usado em chamadas de voz, mensagens e mensalidade do número. Sem crédito, ligações e disparos ficam
            bloqueados.
          </p>
          <Button size="sm" className="mt-3" onClick={() => setIsPurchaseOpen(true)}>
            Recarregar
          </Button>
        </div>

        <div className="rounded-[22px] border bg-card p-4">
          <div className="mb-2 flex flex-wrap gap-2">
            {months.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={month === option.value ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setMonth(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <CostRow
            title="Chamadas de voz"
            detail={`${costs.calls.count} ${costs.calls.count === 1 ? "chamada" : "chamadas"} · ${costs.calls.minutes} min`}
            chargedBy="ORBITA"
            value={formatStars(costs.calls.stars)}
          />
          <CostRow
            title="Mensagens pelo chat"
            detail={`${costs.chatMessages.count.toLocaleString("pt-BR")} ${costs.chatMessages.count === 1 ? "mensagem" : "mensagens"}`}
            chargedBy="ORBITA"
            value={formatStars(costs.chatMessages.stars)}
          />
          <CostRow title="Mensalidade do número" chargedBy="ORBITA" value={formatStars(costs.numberFee.stars)} />
          <CostRow
            title="Mensagens e disparos"
            detail={
              costs.storedMetaSpend.byCategory.length > 0
                ? costs.storedMetaSpend.byCategory.map((item) => `${item.category} ${formatBrl(item.amount)}`).join(" · ")
                : "Guardado dia a dia a partir de agora. O mês corrente também aparece ao vivo em “Gasto do mês”."
            }
            chargedBy="META"
            value={formatBrl(costs.storedMetaSpend.total)}
          />
        </div>
      </div>

      <div className="rounded-[22px] border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="mr-2 text-sm font-medium">Histórico de custos</p>
          {KIND_FILTERS.map((filter) => (
            <Button
              key={filter.label}
              type="button"
              size="sm"
              variant={kind === filter.kind ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setKind(filter.kind)}
            >
              {filter.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto"
            disabled={entries.length === 0}
            onClick={() => downloadEntriesAsCsv(entries, month)}
          >
            Exportar
          </Button>
        </div>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum custo registrado neste período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Data</th>
                  <th className="px-2 py-2 font-medium">O quê</th>
                  <th className="px-2 py-2 font-medium">Detalhe</th>
                  <th className="px-2 py-2 font-medium">Cobrado por</th>
                  <th className="px-2 py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t whitespace-nowrap">
                    <td className="px-2 py-2 tabular-nums">
                      {new Date(entry.occurredAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-2 py-2">{entry.title}</td>
                    <td className="px-2 py-2 text-muted-foreground">{entry.detail}</td>
                    <td className="px-2 py-2">
                      <ChargedByTag chargedBy={entry.chargedBy} />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {entry.stars !== null ? formatStars(entry.stars) : entry.amountBrl !== null ? formatBrl(entry.amountBrl) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StarsPurchaseModal open={isPurchaseOpen} onClose={() => setIsPurchaseOpen(false)} />
    </div>
  );
}
