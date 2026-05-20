"use client";

import { useEffect, useMemo, useState } from "react";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateScript,
  useDeleteScript,
  useScripts,
  useUpdateScript,
} from "../hooks/use-scripts";

const VARIABLES = [
  { label: "Nome do cliente", value: "{{nome_cliente}}" },
  { label: "Telefone", value: "{{telefone}}" },
  { label: "Data de hoje", value: "{{data_hoje}}" },
  { label: "Nome do responsável", value: "{{responsavel}}" },
];

type Script = { id: string; name: string; content: string };

interface ScriptsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string;
  onSelectScript: (content: string) => void;
  leadName?: string;
  leadPhone?: string;
  responsibleName?: string;
}

type FormMode = { type: "create" } | { type: "edit"; script: Script };

export function ScriptsPanel({
  open,
  onOpenChange,
  trackingId,
  onSelectScript,
  leadName,
  leadPhone,
  responsibleName,
}: ScriptsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);

  const { data: scripts = [], isLoading } = useScripts(trackingId);
  const deleteScript = useDeleteScript(trackingId);

  useEffect(() => {
    if (!open) return;
    if (scripts.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !scripts.some((s) => s.id === selectedId)) {
      setSelectedId(scripts[0].id);
    }
  }, [open, scripts, selectedId]);

  const resolveVariables = useMemo(() => {
    return (content: string) => {
      const today = new Date().toLocaleDateString("pt-BR");
      return content
        .replace(/\{\{nome_cliente\}\}/g, leadName ?? "{{nome_cliente}}")
        .replace(/\{\{telefone\}\}/g, leadPhone ?? "{{telefone}}")
        .replace(/\{\{data_hoje\}\}/g, today)
        .replace(/\{\{responsavel\}\}/g, responsibleName ?? "{{responsavel}}");
    };
  }, [leadName, leadPhone, responsibleName]);

  const selectedScript = scripts.find((s) => s.id === selectedId) ?? null;

  function handleUse(script: Script) {
    onSelectScript(resolveVariables(script.content));
    onOpenChange(false);
  }

  function handleDelete(script: Script) {
    deleteScript.mutate(
      { id: script.id },
      {
        onSuccess: () => {
          if (selectedId === script.id) setSelectedId(null);
        },
      },
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverAnchor
          aria-hidden
          className="absolute top-0 left-0 size-0 pointer-events-none"
        />
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-[min(640px,calc(100vw-2rem))] p-0 overflow-hidden"
          onOpenAutoFocus={(e) => {
            // deixa o foco ir naturalmente para o CommandInput
            e.preventDefault();
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold">Meus Scripts</span>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setFormMode({ type: "create" })}
            >
              <PlusIcon className="size-3" />
              Adicionar Script
            </Button>
          </div>

          <div className="flex h-105">
            <div className="w-64 border-r flex flex-col">
              <Command
                value={selectedId ?? ""}
                onValueChange={setSelectedId}
                className="flex-1"
              >
                <CommandInput
                  placeholder="Pesquisar script"
                  autoFocus
                />
                <CommandList className="max-h-none flex-1">
                  {isLoading ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Carregando...
                    </p>
                  ) : (
                    <CommandEmpty>Nenhum script encontrado</CommandEmpty>
                  )}
                  {scripts.map((script) => (
                    <CommandItem
                      key={script.id}
                      value={script.id}
                      keywords={[script.name]}
                      onSelect={() => setSelectedId(script.id)}
                      className="text-sm"
                    >
                      {script.name}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              {selectedScript ? (
                <>
                  <div className="flex items-center justify-between px-4 py-3 border-b gap-2">
                    <h3 className="text-sm font-semibold truncate">
                      {selectedScript.name}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        aria-label="Editar script"
                        onClick={() =>
                          setFormMode({ type: "edit", script: selectedScript })
                        }
                      >
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:text-destructive"
                        aria-label="Excluir script"
                        disabled={deleteScript.isPending}
                        onClick={() => handleDelete(selectedScript)}
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 px-4 py-3 overflow-y-auto scroll-cols-tracking">
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed pr-2">
                      {resolveVariables(selectedScript.content)}
                    </p>
                  </ScrollArea>

                  <div className="border-t px-4 py-3">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleUse(selectedScript)}
                    >
                      Usar script
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center px-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    {scripts.length === 0
                      ? "Crie seu primeiro script para começar."
                      : "Selecione um script à esquerda para visualizar."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <ScriptFormDialog
        mode={formMode}
        trackingId={trackingId}
        onClose={() => setFormMode(null)}
        onSaved={(id) => {
          setSelectedId(id);
          setFormMode(null);
        }}
      />
    </>
  );
}

interface ScriptFormDialogProps {
  mode: FormMode | null;
  trackingId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}

function ScriptFormDialog({
  mode,
  trackingId,
  onClose,
  onSaved,
}: ScriptFormDialogProps) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  const createScript = useCreateScript(trackingId);
  const updateScript = useUpdateScript(trackingId);

  useEffect(() => {
    if (!mode) return;
    if (mode.type === "edit") {
      setName(mode.script.name);
      setContent(mode.script.content);
    } else {
      setName("");
      setContent("");
    }
  }, [mode]);

  const isPending = createScript.isPending || updateScript.isPending;
  const canSave = name.trim().length > 0 && content.trim().length > 0;

  function handleSave() {
    if (!mode || !canSave) return;
    if (mode.type === "create") {
      createScript.mutate(
        { name, content, trackingId },
        { onSuccess: (created) => onSaved(created.id) },
      );
    } else {
      updateScript.mutate(
        { id: mode.script.id, name, content },
        { onSuccess: () => onSaved(mode.script.id) },
      );
    }
  }

  function insertVariable(variable: string) {
    setContent((prev) => prev + variable);
  }

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode?.type === "edit" ? "Editar script" : "Novo script"}
          </DialogTitle>
          <DialogDescription>
            Crie modelos de mensagens com variáveis que serão substituídas
            automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="script-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Nome do script
            </label>
            <Input
              id="script-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Boas-vindas"
            />
          </div>

          <div className="flex flex-col gap-1.5 max-w-full">
            <label 
              htmlFor="script-content"
              className="text-xs font-medium text-muted-foreground"
            >
              Conteúdo
            </label>
            <Textarea
              id="script-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Digite o conteúdo do script..."
              className="min-h-55 max-h-80 text-sm w-full break-words [overflow-wrap:anywhere]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Inserir variável
            </span>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => insertVariable(v.value)}
                  className="text-xs bg-muted hover:bg-muted/70 rounded px-2 py-1 transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
