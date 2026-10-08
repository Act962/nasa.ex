"use client";

import { PlusIcon, Trash2Icon, LayoutDashboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspaces, useWorkspaceColumnOptions } from "@/features/workspace/hooks/use-workspace";
import type { DraftSetter, TaskDraft } from "./wizard-options";

/** Passo 4 do assistente de campanha: sub-ações da equipe. */

interface StepTasksProps {
  newTask: TaskDraft;
  setNewTask: DraftSetter<TaskDraft>;
  tasks: TaskDraft[];
  setTasks: DraftSetter<TaskDraft[]>;
  onAddTask: () => void;
}

export function StepTasks({ newTask, setNewTask, tasks, setTasks, onAddTask }: StepTasksProps) {
  const { data: workspacesData } = useWorkspaces();
  const workspaces = workspacesData?.workspaces ?? [];
  const { columns: taskColumns } = useWorkspaceColumnOptions(newTask.workspaceId ?? "");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Crie as sub-ações iniciais da equipe para esta campanha.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label>Título da Sub-ação *</Label>
          <Input placeholder="Ex: Criar artes para redes sociais" value={newTask.title} onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Prioridade</Label>
          <Select value={newTask.priority} onValueChange={(v) => setNewTask((t) => ({ ...t, priority: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">🟢 Baixa</SelectItem>
              <SelectItem value="MEDIUM">🟡 Média</SelectItem>
              <SelectItem value="HIGH">🟠 Alta</SelectItem>
              <SelectItem value="CRITICAL">🔴 Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Prazo</Label>
          <Input type="date" value={newTask.dueDate} onChange={(e) => setNewTask((t) => ({ ...t, dueDate: e.target.value }))} />
        </div>
      </div>
      {/* Workspace + Column for task */}
      <div className="border rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
          <LayoutDashboardIcon className="size-3.5" /> Refletir no Workspace <span className="text-[10px]">(opcional)</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Select value={newTask.workspaceId ?? "__none__"} onValueChange={(v) => setNewTask((t) => ({ ...t, workspaceId: v === "__none__" ? undefined : v, columnId: undefined }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Workspace" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum</SelectItem>
              {workspaces.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={newTask.columnId ?? ""} onValueChange={(v) => setNewTask((t) => ({ ...t, columnId: v || undefined }))} disabled={!newTask.workspaceId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status / Coluna" /></SelectTrigger>
            <SelectContent>
              {taskColumns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onAddTask} disabled={!newTask.title} className="gap-1">
        <PlusIcon className="size-3.5" /> Adicionar Sub-ação
      </Button>
      {tasks.length > 0 && (
        <div className="space-y-2">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center justify-between text-sm bg-muted/50 px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="font-medium">{task.title}</span>
                <Badge variant="secondary" className="text-xs capitalize">{task.priority.toLowerCase()}</Badge>
              </div>
              <Button variant="ghost" size="icon" className="size-6" onClick={() => setTasks((t) => t.filter((_, j) => j !== i))}>
                <Trash2Icon className="size-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
