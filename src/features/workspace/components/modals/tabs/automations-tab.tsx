"use client";

import { useState } from "react";
import { Plus, Trash2, PlayIcon, PauseIcon, ChevronDownIcon, ChevronRightIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useListAutomations,
  useCreateAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
} from "@/features/workspace/hooks/use-workspace";

const TRIGGER_OPTIONS = [
  { value: "MANUAL", label: "Manual" },
  { value: "NEW_CARD", label: "Novo card criado" },
  { value: "MOVE_CARD", label: "Card movido de coluna" },
  { value: "CARD_TAGGED", label: "Tag adicionada ao card" },
];

const STEP_TYPES = [
  { value: "MOVE_CARD", label: "Mover card" },
  { value: "SEND_MESSAGE", label: "Enviar mensagem" },
  { value: "WAIT", label: "Aguardar" },
  { value: "ARCHIVE", label: "Arquivar" },
  { value: "ADD_TAG", label: "Adicionar tag" },
  { value: "SET_RESPONSIBLE", label: "Definir responsável" },
  { value: "CREATE_POST", label: "Criar Post" },
];

export function AutomationsTab({ workspaceId }: { workspaceId: string }) {
  const { automations, isLoading } = useListAutomations(workspaceId);
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation(workspaceId);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("MANUAL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!name.trim()) return;
    createAutomation.mutate(
      { workspaceId, name: name.trim(), trigger, steps: [], conditions: [] },
      { onSuccess: () => { setName(""); setTrigger("MANUAL"); setCreating(false); } },
    );
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando automações...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Automações</h3>
          <p className="text-sm text-muted-foreground">Configure gatilhos e ações automáticas para este workspace.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4 mr-1" />Nova Automação
        </Button>
      </div>

      {creating && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
          <h4 className="font-medium text-sm">Nova Automação</h4>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Nome</Label>
              <Input placeholder="Ex: Mover para Concluído ao marcar feito" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Gatilho</Label>
              <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className="h-8 rounded-md border border-input bg-background px-3 text-sm">
                {TRIGGER_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!name.trim() || createAutomation.isPending}>
              {createAutomation.isPending ? "Criando..." : "Criar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setName(""); }}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {automations.length === 0 && !creating && (
          <div className="text-center py-10 border rounded-lg bg-muted/10">
            <ZapIcon className="size-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Nenhuma automação configurada</p>
            <p className="text-xs text-muted-foreground mt-1">Crie automações para agilizar seu fluxo de trabalho</p>
          </div>
        )}
        {automations.map((auto: any) => (
          <div key={auto.id} className="border rounded-lg bg-background overflow-hidden">
            <div className="flex items-center gap-3 p-3">
              <div className={cn("size-2 rounded-full shrink-0", auto.isActive ? "bg-emerald-500" : "bg-muted-foreground")} />
              <span className="flex-1 font-medium text-sm">{auto.name}</span>
              <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                {TRIGGER_OPTIONS.find((t) => t.value === auto.trigger)?.label ?? auto.trigger}
              </span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="size-7" title={auto.isActive ? "Pausar" : "Ativar"}
                  onClick={() => updateAutomation.mutate({ automationId: auto.id, isActive: !auto.isActive })}>
                  {auto.isActive ? <PauseIcon className="size-3.5 text-yellow-500" /> : <PlayIcon className="size-3.5 text-emerald-500" />}
                </Button>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => setExpandedId(expandedId === auto.id ? null : auto.id)}>
                  {expandedId === auto.id ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="size-7 text-destructive hover:bg-destructive/10"
                  onClick={() => confirm(`Excluir automação "${auto.name}"?`) && deleteAutomation.mutate({ automationId: auto.id })}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            {expandedId === auto.id && (
              <div className="border-t px-4 py-3 bg-muted/20 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Passos</p>
                {(auto.steps as any[]).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum passo configurado. Edite para adicionar ações.</p>
                ) : (
                  <div className="space-y-1">
                    {(auto.steps as any[]).map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="size-4 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-[9px]">{i + 1}</span>
                        <span>{STEP_TYPES.find((s) => s.value === step.type)?.label ?? step.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
