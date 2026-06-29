"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Briefcase, Download, AlertCircle, Tag, Zap } from "lucide-react";
import { formatDuration, exportToCSV } from "./format-utils";

interface Props {
  from: string;
  to: string;
  memberIds: string[];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function WorkspacesReport({ from, to, memberIds }: Props) {
  const { data, isLoading } = useQuery({
    ...orpc.insights.getWorkspacesReport.queryOptions({
      input: { from, to, memberIds: memberIds.length > 0 ? memberIds : undefined },
    }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const workspaces = data?.workspaces ?? [];

  const handleExport = () => {
    const rows = workspaces.map((ws) => ({
      Workspace: ws.name,
      Tracking: ws.tracking?.name ?? "",
      Projeto: ws.orgProject?.name ?? "",
      "Total ações": ws.totals.actions,
      Concluídas: ws.totals.completed,
      Atrasadas: ws.totals.overdue,
      "Sem tag": ws.totals.missingTag,
      Participantes: ws.totals.participants,
      "Tempo médio conclusão": formatDuration(ws.avgCompletionMs),
      "Automações ativas": ws.totals.activeAutomations,
      "Total automações": ws.totals.automations,
    }));
    exportToCSV(rows, `workspaces-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Briefcase className="size-4" />
          <strong className="text-foreground">{data?.totalWorkspaces ?? 0}</strong>
          {(data?.totalWorkspaces ?? 0) === 1 ? "workspace" : "workspaces"}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={workspaces.length === 0}
        >
          <Download className="size-3.5 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      {workspaces.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          Nenhum workspace encontrado para o período/filtros selecionados.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Projeto/Cliente</TableHead>
                <TableHead className="text-right">Ações</TableHead>
                <TableHead className="text-right">Atrasadas</TableHead>
                <TableHead className="text-right">Sem tag</TableHead>
                <TableHead className="text-right">Tempo médio</TableHead>
                <TableHead>Participantes</TableHead>
                <TableHead className="text-right">Automações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspaces.map((ws) => (
                <TableRow key={ws.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="size-3 rounded-sm shrink-0"
                        style={{ backgroundColor: ws.color ?? "#1447e6" }}
                      />
                      <span className="font-medium">{ws.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {ws.orgProject?.name ?? ws.tracking?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-medium">{ws.totals.actions}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {ws.totals.completed} concluídas
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {ws.totals.overdue > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="size-3" />
                        {ws.totals.overdue}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {ws.totals.missingTag > 0 ? (
                      <Badge variant="outline" className="gap-1">
                        <Tag className="size-3" />
                        {ws.totals.missingTag}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {formatDuration(ws.avgCompletionMs)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center -space-x-2">
                      {ws.participants.slice(0, 4).map((p) => (
                        <Avatar key={p.id} className="size-6 border-2 border-background">
                          <AvatarImage src={p.image ?? ""} />
                          <AvatarFallback className="text-[9px]">
                            {initials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {ws.participants.length > 4 && (
                        <div className="size-6 rounded-full bg-muted border-2 border-background text-[10px] flex items-center justify-center">
                          +{ws.participants.length - 4}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={ws.totals.activeAutomations > 0 ? "default" : "secondary"}
                      className="gap-1"
                    >
                      <Zap className="size-3" />
                      {ws.totals.activeAutomations}/{ws.totals.automations}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
