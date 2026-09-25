"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAstroRuns } from "@/features/astro-commander/hooks/use-astro-runs";
import {
  RUN_STATUS_LABELS,
  RUN_STATUS_TONES,
  RUN_TRIGGER_LABELS,
  formatDateTime,
  formatDuration,
} from "@/features/astro-commander/lib/labels";

/** Execuções do comando (spec 0023, RF-24). */
export function CommandRunsSection({ commandId }: { commandId: string }) {
  const { runs, isLoading } = useAstroRuns({ commandId, limit: 50 });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        Este comando ainda não rodou. Use &quot;Testar comando&quot; para ver o
        resultado sem enviar nada.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Execuções</h2>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Gatilho</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Stars</TableHead>
              <TableHead>Resumo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDateTime(run.startedAt)}
                </TableCell>
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
                <TableCell className="max-w-sm">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {run.error ?? run.summary ?? "—"}
                  </p>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
