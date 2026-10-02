"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateAstroCommand,
  useDraftAstroCommand,
} from "@/features/astro-commander/hooks/use-astro-commands";
import {
  AUTONOMY_LABELS,
  PERSONA_LABELS,
  formatDateTime,
} from "@/features/astro-commander/lib/labels";

/**
 * Criar comando em duas etapas (spec 0028, RF-1): o usuário descreve, o ASTRO
 * devolve um rascunho estruturado e só então o comando é salvo. Nada é criado
 * a partir do que o modelo entendeu sem alguém confirmar.
 */

type Draft = {
  title: string;
  persona: "SALES" | "FINANCE" | "ADMIN" | "ACCOUNTING" | "CUSTOM";
  triggerType: "ONCE" | "SCHEDULE" | "EVENT";
  cron: string | null;
  eventKey: string | null;
  autonomy: "DRAFT" | "APPROVE_ABOVE" | "AUTO";
  summary: string;
  instruction: string;
  triggerLabel: string;
  nextRunAt: string | null;
  timezone: string;
};

const DEFAULT_EXAMPLES = [
  "todo dia às 8h conciliar extrato",
  "responder leads novos, ler todo o histórico de mensagens e enviar proposta caso precise",
  "toda segunda às 9h me mandar o resumo das conversas sem resposta",
];

export function CreateCommandDialog({
  open,
  onOpenChange,
  examples,
  initialInstruction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Exemplos da área de onde o dialog foi aberto (spec 0029, RF-12). */
  examples?: string[];
  initialInstruction?: string;
}) {
  const router = useRouter();
  const [instruction, setInstruction] = useState(initialInstruction ?? "");
  const suggestions = examples && examples.length > 0 ? examples : DEFAULT_EXAMPLES;

  // Cada abertura pode vir de uma área diferente, com texto inicial próprio.
  useEffect(() => {
    if (open) setInstruction(initialInstruction ?? "");
  }, [open, initialInstruction]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftCommand = useDraftAstroCommand();
  const createCommand = useCreateAstroCommand();

  function reset() {
    setInstruction("");
    setDraft(null);
  }

  function handleInterpret() {
    draftCommand.mutate(
      { instruction: instruction.trim() },
      {
        onSuccess: (result) => setDraft(result.draft as Draft),
        onError: (error) =>
          toast.error(error.message || "Não consegui entender o comando"),
      },
    );
  }

  function handleCreate(activate: boolean) {
    if (!draft) return;
    createCommand.mutate(
      {
        title: draft.title,
        instruction: draft.instruction,
        persona: draft.persona,
        triggerType: draft.triggerType,
        cron: draft.cron,
        eventKey: draft.eventKey,
        timezone: draft.timezone,
        autonomy: draft.autonomy,
        status: activate ? "ACTIVE" : "DRAFT",
      },
      {
        onSuccess: (result) => {
          toast.success(activate ? "Comando ativo" : "Comando salvo como rascunho");
          onOpenChange(false);
          reset();
          router.push(`/astro/comandos/${result.command.id}`);
        },
        onError: (error) => toast.error(error.message || "Erro ao criar comando"),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Criar comando</DialogTitle>
          <DialogDescription>
            Escreva a ordem do jeito que você falaria. O ASTRO monta o comando e
            você confere antes de salvar.
          </DialogDescription>
        </DialogHeader>

        {!draft ? (
          <div className="space-y-3">
            <Textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Ex.: todo dia às 8h conciliar extrato"
              rows={4}
            />
            <div className="flex flex-wrap gap-2">
              {suggestions.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setInstruction(example)}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Nome do comando
              </label>
              <Input
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </div>

            <p className="text-sm text-muted-foreground">{draft.summary}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Papel
                </label>
                <Select
                  value={draft.persona}
                  onValueChange={(value) =>
                    setDraft({ ...draft, persona: value as Draft["persona"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERSONA_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Autonomia
                </label>
                <Select
                  value={draft.autonomy}
                  onValueChange={(value) =>
                    setDraft({ ...draft, autonomy: value as Draft["autonomy"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUTONOMY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Quando roda</span>
                <Badge variant="secondary">{draft.triggerLabel}</Badge>
              </div>
              {draft.nextRunAt && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Primeira execução</span>
                  <span>{formatDateTime(draft.nextRunAt)}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Ações financeiras sempre passam por aprovação, mesmo no modo
              automático. Você ajusta as ferramentas depois, na página do comando.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!draft ? (
            <Button
              onClick={handleInterpret}
              disabled={instruction.trim().length < 5 || draftCommand.isPending}
            >
              {draftCommand.isPending ? (
                <OrbitaSpinner className="size-4 " />
              ) : (
                <Wand2 className="size-4" />
              )}
              Interpretar
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Voltar
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCreate(false)}
                disabled={createCommand.isPending}
              >
                Salvar rascunho
              </Button>
              <Button
                onClick={() => handleCreate(true)}
                disabled={createCommand.isPending}
              >
                {createCommand.isPending && (
                  <OrbitaSpinner className="size-4 " />
                )}
                Criar e ativar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
