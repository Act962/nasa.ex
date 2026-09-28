"use client";

import { CheckCircle2, CircleSlash, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCommentsRuns } from "../hooks/use-comments-automations";

const STATUS_ICON = {
  SENT: CheckCircle2,
  SKIPPED: CircleSlash,
  FAILED: XCircle,
  PENDING: CircleSlash,
} as const;

/**
 * Histórico de execuções. É a tela que responde "por que não respondeu?" —
 * sem ela, automação que não dispara vira suporte.
 */
export function RunsPanel({ automationId }: { automationId?: string }) {
  const { data: runs, isLoading } = useCommentsRuns(automationId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Últimas execuções</CardTitle>
        <CardDescription>
          Cada evento recebido e o que a automação fez com ele.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        )}

        {!isLoading && (runs ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma execução ainda.
          </p>
        )}

        {(runs ?? []).map((run) => {
          const Icon = STATUS_ICON[run.status as keyof typeof STATUS_ICON];
          return (
            <div
              key={run.id}
              className="flex items-start gap-2 rounded-md border p-2 text-sm"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{run.automation.name}</p>
                <p className="text-xs text-muted-foreground">
                  {run.contact?.username
                    ? `@${run.contact.username}`
                    : (run.contact?.externalUserId ?? "—")}
                  {" · "}
                  {new Date(run.startedAt).toLocaleString("pt-BR")}
                </p>
                {run.error && (
                  <p className="mt-1 text-xs text-destructive">{run.error}</p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
