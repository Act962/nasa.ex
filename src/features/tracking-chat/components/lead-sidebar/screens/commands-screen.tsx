"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AstroMark } from "@/features/astro/components/astro-mark";
import { openCreateCommand } from "@/features/astro-commander/lib/open-create-command";
import { useLeadCommandRuns } from "@/features/leads/hooks/use-lead-chat-sidebar";
import { ScreenList, formatDateTime } from "./screen-list";

const RUN_STATUS_LABELS: Record<string, string> = {
  RUNNING: "Rodando",
  SUCCEEDED: "Concluído",
  FAILED: "Falhou",
  WAITING_APPROVAL: "Aguardando aprovação",
  SKIPPED_LIMIT: "Barrado por limite",
  SKIPPED: "Ignorado",
};

export function CommandsScreen({ leadId, leadName }: { leadId: string; leadName: string }) {
  const { data, isLoading } = useLeadCommandRuns(leadId);
  const runs = data?.runs ?? [];

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        className="w-fit gap-2"
        onClick={() =>
          openCreateCommand({
            examples: [
              `Todo dia às 9h me lembra de retornar para ${leadName}`,
              `Se ${leadName} não responder em 2 dias, manda um follow-up`,
            ],
          })
        }
      >
        <AstroMark className="size-4" />
        Criar comando
      </Button>
      <ScreenList isLoading={isLoading} isEmpty={runs.length === 0} emptyText="Nenhum comando do ASTRO rodou para este lead.">
        {runs.map((run) => (
          <li key={run.id} className="rounded-lg border bg-card px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/astro/comandos/${run.command.id}`} className="truncate text-sm font-medium hover:underline">
                {run.command.title}
              </Link>
              <Badge variant={run.status === "FAILED" ? "destructive" : "secondary"}>
                {RUN_STATUS_LABELS[run.status] ?? run.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{formatDateTime(run.startedAt)}</p>
            {run.summary && <p className="mt-1 line-clamp-3 text-xs">{run.summary}</p>}
          </li>
        ))}
      </ScreenList>
    </div>
  );
}
