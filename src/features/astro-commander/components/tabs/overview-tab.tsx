"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Activity, CircleCheck, Clock, Pause, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAstroRuns, useAstroUsage } from "@/features/astro-commander/hooks/use-astro-runs";
import { useSetCommanderPaused } from "@/features/astro-commander/hooks/use-astro-commands";
import {
  RUN_STATUS_LABELS,
  RUN_STATUS_TONES,
  RUN_TRIGGER_LABELS,
  formatDateTime,
  formatDuration,
} from "@/features/astro-commander/lib/labels";

/** Painel e custos da organização (spec 0028, RF-12). */

const PERIODS = [
  { value: "1", label: "Hoje" },
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
] as const;

export function OverviewTab() {
  const [days, setDays] = useState("7");
  const { usage, isLoading } = useAstroUsage({ days: Number(days) });
  const { runs } = useAstroRuns({ limit: 15 });
  const setPaused = useSetCommanderPaused();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-10 w-36 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((period) => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setPaused.mutate(
                { paused: true },
                { onSuccess: () => toast.success("Todos os comandos pausados") },
              )
            }
          >
            <Pause className="size-4" />
            Pausar tudo
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              setPaused.mutate(
                { paused: false },
                { onSuccess: () => toast.success("Comandos retomados") },
              )
            }
          >
            <Play className="size-4" />
            Retomar
          </Button>
        </div>
      </div>

      {isLoading || !usage ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((card) => (
            <Skeleton key={card} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<Activity className="size-4" />}
            label="Execuções"
            value={usage.totalRuns.toLocaleString("pt-BR")}
            hint={`${usage.failed} com falha`}
          />
          <MetricCard
            icon={<CircleCheck className="size-4" />}
            label="Taxa de sucesso"
            value={`${Math.round(usage.successRate * 100)}%`}
            hint={`${usage.succeeded} concluídas`}
          />
          <MetricCard
            icon={<Clock className="size-4" />}
            label="Aguardando aprovação"
            value={usage.pendingApprovals.toLocaleString("pt-BR")}
            hint="na fila agora"
          />
          <MetricCard
            icon={<Star className="size-4" />}
            label="Stars no período"
            value={usage.stars.toLocaleString("pt-BR")}
            hint={`${usage.tokens.toLocaleString("pt-BR")} tokens`}
          />
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Últimas execuções</h2>
        {runs.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-14 text-center text-sm text-muted-foreground">
            Nenhuma execução ainda.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comando</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Stars</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.commandTitle}</TableCell>
                    <TableCell className="text-sm">
                      {RUN_TRIGGER_LABELS[run.trigger]}
                    </TableCell>
                    <TableCell>
                      <Badge variant={RUN_STATUS_TONES[run.status]}>
                        {RUN_STATUS_LABELS[run.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDuration(run.durationMs)}
                    </TableCell>
                    <TableCell className="text-sm">{run.starsCharged}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(run.startedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
