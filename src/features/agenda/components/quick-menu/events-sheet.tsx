"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useColumnsByWorkspace, useWorkspaces } from "@/features/workspace/hooks/use-workspace";
import { readLastWorkspaceId } from "@/features/workspace/lib/last-workspace";
import { useCreateTask } from "@/features/actions/hooks/use-tasks";
import { QuickMenuEmpty, QuickMenuSheet } from "./quick-menu-sheet";

/** Eventos: cria uma ação com data no Workspace — ela já aparece no Calendário da Agenda. */
export function EventsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: workspacesData, isLoading: isLoadingWorkspaces } = useWorkspaces();
  const workspaces = workspacesData?.workspaces ?? [];
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const lastWorkspaceId = readLastWorkspaceId();
  const workspaceId =
    selectedWorkspaceId ??
    (workspaces.some((workspace) => workspace.id === lastWorkspaceId) ? lastWorkspaceId : workspaces[0]?.id) ??
    "";
  const { columns } = useColumnsByWorkspace(workspaceId);
  const createTask = useCreateTask();
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [eventTime, setEventTime] = useState("09:00");

  const createEvent = () => {
    const firstColumnId = columns[0]?.id;
    if (!title.trim()) return toast.error("Dê um nome para o evento.");
    if (!workspaceId || !firstColumnId) return toast.error("Esse workspace ainda não tem colunas.");
    const startsAt = dayjs(`${eventDate}T${eventTime}`).toDate();
    createTask.mutate(
      { title: title.trim(), priority: "MEDIUM", workspaceId, columnId: firstColumnId, startDate: startsAt, dueDate: startsAt },
      {
        onSuccess: () => {
          toast.success("Evento criado! Ele aparece no Calendário da Agenda.");
          setTitle("");
          onOpenChange(false);
        },
        onError: () => toast.error("Não consegui criar o evento agora."),
      },
    );
  };

  return (
    <QuickMenuSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={<Sparkles className="text-success" />}
      title="Eventos"
      description="Crie um evento no Workspace. Ele aparece no Calendário da Agenda, em verde."
      footer={
        workspaces.length > 0 && (
          <Button className="h-12 w-full rounded-full" disabled={createTask.isPending} onClick={createEvent}>
            {createTask.isPending ? "Criando…" : "Criar evento"}
          </Button>
        )
      }
    >
      {!isLoadingWorkspaces && workspaces.length === 0 ? (
        <QuickMenuEmpty>Crie um workspace primeiro para guardar seus eventos.</QuickMenuEmpty>
      ) : (
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nome do evento (ex.: Workshop de vendas)"
            className="h-11"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="h-11" />
            <Input type="time" value={eventTime} onChange={(event) => setEventTime(event.target.value)} className="h-11" />
          </div>
          <Select value={workspaceId} onValueChange={setSelectedWorkspaceId}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue placeholder="Workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {columns[0] && (
            <p className="text-xs text-muted-foreground">Vai para a coluna “{columns[0].name}” do workspace.</p>
          )}
        </div>
      )}
    </QuickMenuSheet>
  );
}
