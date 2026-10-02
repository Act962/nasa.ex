"use client";

import { useState } from "react";
import { Archive, Brain, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useAstroMemories,
  useCreateAstroMemory,
  useDeleteAstroMemory,
  useSetAstroMemoryStatus,
} from "@/features/astro-commander/hooks/use-astro-intelligence";

/**
 * Memórias e regras (spec 0028, RF-14). As ativas entram no prompt do chat, dos
 * comandos e do site, acima de qualquer instrução que chegue por mensagem.
 */

const KIND_LABELS: Record<string, string> = {
  FACT: "Fato",
  RULE: "Regra",
  PREFERENCE: "Preferência",
};

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "escrita por você",
  FEEDBACK: "veio de uma correção",
  EXECUTION: "veio de uma execução",
};

export function MemoriesSection() {
  const { memories, suggestedCount, activeCount, isLoading } = useAstroMemories();
  const createMemory = useCreateAstroMemory();
  const setStatus = useSetAstroMemoryStatus();
  const deleteMemory = useDeleteAstroMemory();

  const [kind, setKind] = useState("RULE");
  const [content, setContent] = useState("");

  const suggested = memories.filter((memory) => memory.status === "SUGGESTED");
  const active = memories.filter((memory) => memory.status === "ACTIVE");
  const archived = memories.filter((memory) => memory.status === "ARCHIVED");

  const submit = () => {
    const trimmed = content.trim();
    if (trimmed.length < 4) return;
    createMemory.mutate(
      { kind: kind as "FACT" | "RULE" | "PREFERENCE", content: trimmed },
      {
        onSuccess: () => {
          setContent("");
          toast.success("Regra ativa. O ASTRO já segue a partir de agora.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Brain className="size-4 text-muted-foreground" />
          Memórias e regras
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Limites e fatos da empresa — desconto máximo, tom de voz, o que nunca prometer. Valem
          acima do que qualquer mensagem pedir. {activeCount} ativa(s).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="RULE">Regra</SelectItem>
            <SelectItem value="FACT">Fato</SelectItem>
            <SelectItem value="PREFERENCE">Preferência</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={content}
          maxLength={500}
          placeholder="Ex.: desconto máximo de 10% sem aprovação do dono."
          className="min-w-[16rem] flex-1"
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
        <Button onClick={submit} disabled={content.trim().length < 4 || createMemory.isPending}>
          <Plus className="size-4" />
          Adicionar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-5">
          {suggested.length > 0 && (
            <MemoryGroup
              title={`Sugeridas pelo ASTRO (${suggestedCount})`}
              hint="Nasceram das suas correções. Nenhuma vale até você ativar."
              memories={suggested}
              onActivate={(memoryId) =>
                setStatus.mutate(
                  { memoryId, status: "ACTIVE" },
                  { onSuccess: () => toast.success("Regra ativada") },
                )
              }
              onArchive={(memoryId) =>
                setStatus.mutate(
                  { memoryId, status: "ARCHIVED" },
                  { onSuccess: () => toast.success("Sugestão descartada") },
                )
              }
              onDelete={(memoryId) => deleteMemory.mutate({ memoryId })}
            />
          )}

          <MemoryGroup
            title="Valendo agora"
            hint={active.length === 0 ? "Nenhuma regra ativa — o ASTRO segue só as instruções de cada comando." : undefined}
            memories={active}
            onArchive={(memoryId) =>
              setStatus.mutate(
                { memoryId, status: "ARCHIVED" },
                { onSuccess: () => toast.success("Regra arquivada") },
              )
            }
            onDelete={(memoryId) => deleteMemory.mutate({ memoryId })}
          />

          {archived.length > 0 && (
            <MemoryGroup
              title={`Arquivadas (${archived.length})`}
              memories={archived}
              onActivate={(memoryId) =>
                setStatus.mutate(
                  { memoryId, status: "ACTIVE" },
                  { onSuccess: () => toast.success("Regra reativada") },
                )
              }
              onDelete={(memoryId) => deleteMemory.mutate({ memoryId })}
            />
          )}
        </div>
      )}
    </section>
  );
}

type MemoryRow = ReturnType<typeof useAstroMemories>["memories"][number];

function MemoryGroup({
  title,
  hint,
  memories,
  onActivate,
  onArchive,
  onDelete,
}: {
  title: string;
  hint?: string;
  memories: MemoryRow[];
  onActivate?: (memoryId: string) => void;
  onArchive?: (memoryId: string) => void;
  onDelete: (memoryId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {memories.map((memory) => (
        <div
          key={memory.id}
          className={cn(
            "flex items-start justify-between gap-3 rounded-xl border p-3",
            memory.status === "SUGGESTED" && "border-warning/30 bg-warning/[0.06]",
            memory.status === "ARCHIVED" && "opacity-60",
          )}
        >
          <div className="min-w-0">
            <p className="text-sm">{memory.content}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {KIND_LABELS[memory.kind] ?? memory.kind} · {SOURCE_LABELS[memory.source] ?? memory.source}
              {memory.createdBy?.name ? ` · ${memory.createdBy.name}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onActivate && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Ativar"
                onClick={() => onActivate(memory.id)}
              >
                <Check className="size-4" />
              </Button>
            )}
            {onArchive && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Arquivar"
                onClick={() => onArchive(memory.id)}
              >
                <Archive className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Excluir"
              onClick={() => onDelete(memory.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
