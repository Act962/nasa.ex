"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuickWorkflowDialog } from "@/features/workflows/components/quick-builder/quick-workflow-dialog";
import { useLeadCommandRuns } from "@/features/leads/hooks/use-lead-chat-sidebar";
import { useLeadTriggers } from "@/features/leads/hooks/use-lead-triggers";
import { LeadTriggerCard } from "@/features/leads/components/lead-triggers/lead-trigger-card";
import { TriggerIcon } from "@/features/leads/components/lead-triggers/trigger-icon";
import { LEAD_TRIGGER_TEMPLATES } from "@/features/leads/lib/triggers/templates";
import { ScreenList, formatDateTime } from "./screen-list";

// "Gatilho do lead" (spec 0038): cards-modelo de mensagem agendada + o que o
// ASTRO já executou para este lead.

const RUN_STATUS_LABELS: Record<string, string> = {
  RUNNING: "Rodando",
  SUCCEEDED: "Concluído",
  FAILED: "Falhou",
  WAITING_APPROVAL: "Aguardando aprovação",
  SKIPPED_LIMIT: "Barrado por limite",
  SKIPPED: "Ignorado",
};

interface LeadTriggersScreenProps {
  leadId: string;
  leadName: string;
  trackingId: string;
}

export function LeadTriggersScreen({ leadId, leadName, trackingId }: LeadTriggersScreenProps) {
  const { data: runsData, isLoading: isLoadingRuns } = useLeadCommandRuns(leadId);
  const { data: triggersData, isLoading: isLoadingTriggers } = useLeadTriggers(leadId);
  const runs = runsData?.runs ?? [];
  const savedByTemplate = new Map((triggersData?.triggers ?? []).map((trigger) => [trigger.template, trigger]));
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <QuickWorkflowDialog
        isOpen={isBuilderOpen}
        onOpenChange={setIsBuilderOpen}
        trackingId={trackingId}
        leadId={leadId}
        leadName={leadName}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="gap-2" onClick={() => setIsBuilderOpen(true)}>
          <TriggerIcon className="size-4" />
          Criar gatilho
        </Button>
        <Button variant="outline" className="gap-2" asChild>
          <Link href={`/tracking/${trackingId}/workflows`}>
            <TriggerIcon className="size-4" />
            Gatilhos Automáticos
          </Link>
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Modelos de gatilho</h3>
        {isLoadingTriggers ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {LEAD_TRIGGER_TEMPLATES.map((template) => (
              <LeadTriggerCard
                key={template.key}
                leadId={leadId}
                trackingId={trackingId}
                template={template}
                saved={savedByTemplate.get(template.key)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Execuções do ASTRO para este lead</h3>
        <ScreenList isLoading={isLoadingRuns} isEmpty={runs.length === 0} emptyText="Nenhum comando do ASTRO rodou para este lead.">
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
      </section>
    </div>
  );
}
