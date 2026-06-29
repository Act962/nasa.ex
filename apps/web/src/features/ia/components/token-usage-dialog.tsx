"use client";

/**
 * Diálogo "Mais informações" do TokenMeter — detalhamento completo do
 * consumo de tokens da org no ciclo atual.
 *
 * Mostra:
 *   - Cards no topo: tokens total, custo R$, trend %, runs totais
 *   - Tabela "Por provider" com tokens + custo USD/BRL + nº runs
 *   - Tabela "Por modelo" (top 10) com mesma estrutura
 *   - Mini gráfico de barras com tokens/dia últimos 30d
 *
 * Reusa `orpc.ia.usage.overview` (mesma query que o popover compact).
 * Filtros por tracking/source ficam pra próxima iteração — esse
 * diálogo é overview org-wide.
 */
import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import { orpc } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  formatBrl,
  formatTokens,
} from "@/features/ia/lib/token-pricing";

const PROVIDER_LABELS: Record<string, string> = {
  NASA_DEFAULT: "NASA (default)",
  OPENAI: "OpenAI (chave custom)",
  ANTHROPIC: "Anthropic (chave custom)",
  GOOGLE: "Google (chave custom)",
};

export function TokenUsageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: overview, isLoading } = useQuery({
    ...orpc.ia.usage.overview.queryOptions(),
    enabled: open,
    staleTime: 30_000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Consumo de Tokens IA — Detalhes</DialogTitle>
          <DialogDescription>
            Ciclo atual (30 dias) — todos os provedores e modelos usados pela
            sua organização.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !overview ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cards de resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                label="Tokens total"
                value={formatTokens(overview.currentCycle.totalTokens)}
                sub={`${overview.totalRuns} chamadas`}
              />
              <SummaryCard
                label="Custo estimado"
                value={formatBrl(overview.currentCycle.costBrl)}
                sub={`US$ ${overview.currentCycle.costUsd.toFixed(2)}`}
              />
              <SummaryCard
                label="Input"
                value={formatTokens(overview.currentCycle.inputTokens)}
                sub="prompt + context"
              />
              <SummaryCard
                label="Output"
                value={formatTokens(overview.currentCycle.outputTokens)}
                sub="resposta IA"
              />
            </div>

            {/* Trend vs ciclo anterior */}
            {overview.trend.tokensPct !== null && (
              <div className="rounded-md border bg-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Comparação com ciclo anterior (30d antes)
                  </p>
                  <p className="text-sm mt-0.5">
                    {formatTokens(overview.previousCycle.totalTokens)} tokens ·{" "}
                    {formatBrl(overview.previousCycle.costBrl)}
                  </p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <TrendBadge value={overview.trend.tokensPct} label="tokens" />
                  {overview.trend.costPct !== null && (
                    <TrendBadge
                      value={overview.trend.costPct}
                      label="custo"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Daily trend chart */}
            {overview.dailyTrend.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">
                  Consumo diário (últimos 30 dias)
                </h3>
                <DailyTrendChart data={overview.dailyTrend} />
              </div>
            )}

            {/* Tabela por provider */}
            <div>
              <h3 className="text-sm font-medium mb-2">Por provider</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Custo (USD)</TableHead>
                    <TableHead className="text-right">Custo (BRL)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.byProvider.map((p) => (
                    <TableRow key={p.provider}>
                      <TableCell>
                        {PROVIDER_LABELS[p.provider] ?? p.provider}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.runs}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTokens(p.tokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        ${p.costUsd.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatBrl(p.costBrl)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {overview.byProvider.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground text-sm py-6"
                      >
                        Nenhuma chamada de IA no ciclo.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Tabela por modelo */}
            {overview.byModel.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">
                  Por modelo (top 10)
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modelo</TableHead>
                      <TableHead className="text-right">Chamadas</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Custo (BRL)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.byModel.map((m) => (
                      <TableRow key={m.modelId}>
                        <TableCell className="font-mono text-xs">
                          {m.modelId}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.runs}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTokens(m.tokens)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatBrl(m.costBrl)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Nota sobre câmbio + budget */}
            <div className="text-[11px] text-muted-foreground space-y-1 border-t pt-3">
              <p>
                Custo R$ é estimativa usando câmbio fixo (USD × 5,5). Preço
                por token vem da tabela pública dos providers (Out/2024).
              </p>
              <p>
                {overview.softBudgetTokens === null
                  ? "Budget mensal não configurado — defina em Configurações para receber alerta automático."
                  : `Budget mensal: ${formatTokens(overview.softBudgetTokens)} tokens.`}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-1">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function TrendBadge({ value, label }: { value: number; label: string }) {
  const positive = value > 0;
  const color = positive
    ? value > 50
      ? "text-red-500"
      : value > 20
        ? "text-yellow-500"
        : "text-muted-foreground"
    : "text-emerald-500";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        color,
      )}
    >
      {positive ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      {positive ? "+" : ""}
      {Math.round(value)}% {label}
    </div>
  );
}

function DailyTrendChart({
  data,
}: {
  data: Array<{ day: string; tokens: number; costBrl: number }>;
}) {
  const max = Math.max(1, ...data.map((d) => d.tokens));
  return (
    <div className="flex items-end gap-0.5 h-24 border rounded-md p-2 bg-muted/20">
      {data.map((d) => {
        const h = (d.tokens / max) * 100;
        return (
          <div
            key={d.day}
            className="flex-1 group relative"
            title={`${d.day}: ${formatTokens(d.tokens)} (${formatBrl(d.costBrl)})`}
          >
            <div
              className="bg-primary/60 hover:bg-primary rounded-sm transition-colors"
              style={{ height: `${Math.max(2, h)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
