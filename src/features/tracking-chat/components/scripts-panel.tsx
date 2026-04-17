"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useCreateScript,
  useDeleteScript,
  useScripts,
  useUpdateScript,
} from "../hooks/use-scripts";

// Variáveis disponíveis para inserção no conteúdo do script
const VARIABLES = [
  { label: "Nome do cliente", value: "{{nome_cliente}}" },
  { label: "Telefone", value: "{{telefone}}" },
  { label: "Data de hoje", value: "{{data_hoje}}" },
  { label: "Nome do responsável", value: "{{responsavel}}" },
];

interface ScriptsPanelProps {
  trackingId: string;
  onClose: () => void;
  onSelectScript: (content: string) => void;
  leadName?: string;
  leadPhone?: string;
  responsibleName?: string;
}

type View = "list" | "create" | "edit";

export function ScriptsPanel({
  trackingId,
  onClose,
  onSelectScript,
  leadName,
  leadPhone,
  responsibleName,
}: ScriptsPanelProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");

  const { data: scripts = [], isLoading } = useScripts(trackingId);
  const createScript = useCreateScript(trackingId);
  const updateScript = useUpdateScript(trackingId);
  const deleteScript = useDeleteScript(trackingId);

  const filtered = scripts.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  function openCreate() {
    setFormName("");
    setFormContent("");
    setEditingId(null);
    setView("create");
  }

  function openEdit(script: { id: string; name: string; content: string }) {
    setFormName(script.name);
    setFormContent(script.content);
    setEditingId(script.id);
    setView("edit");
  }

  function handleSave() {
    if (!formName.trim() || !formContent.trim()) return;

    if (view === "create") {
      createScript.mutate(
        { name: formName, content: formContent, trackingId },
        { onSuccess: () => setView("list") },
      );
    } else if (view === "edit" && editingId) {
      updateScript.mutate(
        { id: editingId, name: formName, content: formContent },
        { onSuccess: () => setView("list") },
      );
    }
  }

  function insertVariable(variable: string) {
    setFormContent((prev) => prev + variable);
  }

  function resolveVariables(content: string) {
    const today = new Date().toLocaleDateString("pt-BR");
    return content
      .replace(/\{\{nome_cliente\}\}/g, leadName ?? "{{nome_cliente}}")
      .replace(/\{\{telefone\}\}/g, leadPhone ?? "{{telefone}}")
      .replace(/\{\{data_hoje\}\}/g, today)
      .replace(/\{\{responsavel\}\}/g, responsibleName ?? "{{responsavel}}");
  }

  const isPending = createScript.isPending || updateScript.isPending;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 bg-popover border rounded-xl shadow-lg z-50 flex flex-col overflow-hidden max-h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          {view !== "list" && (
            <button
              onClick={() => setView("list")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRightIcon className="size-4 rotate-180" />
            </button>
          )}
          <span className="text-sm font-semibold">
            {view === "list"
              ? "Meus Scripts"
              : view === "create"
                ? "Novo Script"
                : "Editar Script"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {view === "list" && (
            <Button size="sm" onClick={openCreate} className="h-7 text-xs gap-1">
              <PlusIcon className="size-3" />
              Adicionar Script
            </Button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground ml-1 transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      {view === "list" ? (
        <>
          {/* Search */}
          <div className="px-3 py-2 shrink-0">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar script"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1">
            {isLoading && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Carregando...
              </p>
            )}
            {!isLoading && filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum script encontrado
              </p>
            )}
            {filtered.map((script) => (
              <div key={script.id} className="rounded-lg border bg-card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                  onClick={() =>
                    setExpandedId(expandedId === script.id ? null : script.id)
                  }
                >
                  <span className="text-sm font-medium">{script.name}</span>
                  {expandedId === script.id ? (
                    <ChevronDownIcon className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRightIcon className="size-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {expandedId === script.id && (
                  <div className="px-3 pb-3 flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed line-clamp-4">
                      {resolveVariables(script.content)}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={() =>
                          onSelectScript(resolveVariables(script.content))
                        }
                      >
                        Usar script
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => openEdit(script)}
                      >
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => deleteScript.mutate({ id: script.id })}
                        disabled={deleteScript.isPending}
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Create / Edit Form */
        <div className="flex-1 flex flex-col gap-3 px-4 py-3 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Nome do script
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ex: Boas-vindas"
              className="h-8 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Conteúdo
            </label>
            <Textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Digite o conteúdo do script..."
              className="text-sm resize-none min-h-[120px]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Inserir variável
            </label>
            <div className="flex flex-wrap gap-1">
              {VARIABLES.map((v) => (
                <button
                  key={v.value}
                  onClick={() => insertVariable(v.value)}
                  className="text-xs bg-muted hover:bg-muted/70 rounded px-2 py-1 transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setView("list")}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleSave}
              disabled={
                isPending || !formName.trim() || !formContent.trim()
              }
            >
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
