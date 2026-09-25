"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Info, Loader2, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUpdateAstroCommand } from "@/features/astro-commander/hooks/use-astro-commands";
import type { CommandDetailData } from "@/features/astro-commander/components/types";

/** Prompt do comando (spec 0023, RF-21). */

const TEMPLATES: Array<{ label: string; body: string }> = [
  {
    label: "Atendimento consultivo",
    body: `Fale como consultor, não como vendedor.
- Leia o histórico antes de responder e cite o que o cliente já disse.
- Uma pergunta por mensagem.
- Sem preço, prazo ou desconto que não esteja nos dados.`,
  },
  {
    label: "Cobrança cordial",
    body: `Lembre do vencimento sem constranger.
- Diga valor e data com clareza.
- Ofereça o link de pagamento e uma alternativa de contato.
- Nunca ameace, nunca insista mais de uma vez no mesmo dia.`,
  },
  {
    label: "Resumo interno",
    body: `Escreva para o time, não para o cliente.
- Comece pelo número que importa.
- Liste no máximo cinco pontos.
- Termine com o que precisa de decisão humana.`,
  },
];

export function CommandPromptSection({ command }: { command: CommandDetailData }) {
  const update = useUpdateAstroCommand();
  const [greeting, setGreeting] = useState(command.greetingMessage ?? "");
  const [systemPrompt, setSystemPrompt] = useState(command.systemPrompt ?? "");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState("");

  function handleSave(nextPrompt = systemPrompt, nextGreeting = greeting) {
    update.mutate(
      {
        id: command.id,
        greetingMessage: nextGreeting.trim() || null,
        systemPrompt: nextPrompt.trim() || null,
      },
      {
        onSuccess: () => toast.success("Prompt salvo"),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function openEditor() {
    setDraft(systemPrompt);
    setEditorOpen(true);
  }

  function applyTemplate(body: string) {
    const next = systemPrompt.trim() ? `${systemPrompt.trim()}\n\n${body}` : body;
    setSystemPrompt(next);
    toast.success("Modelo aplicado. Revise antes de salvar.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Prompt</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => applyTemplate(TEMPLATES[0]!.body)}
          >
            Usar modelo
          </Button>
          <Button className="h-10 rounded-xl" onClick={openEditor}>
            <Sparkles className="size-4" />
            Editar em tela cheia
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-6 py-4">
          <div>
            <p className="font-medium">Configuração do prompt</p>
            <p className="text-sm text-muted-foreground">
              O que o ASTRO leva em conta toda vez que este comando roda
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
              <Info className="size-4" />
              Guia
            </span>
            <Button variant="secondary" className="h-9 rounded-lg" onClick={openEditor}>
              <Pencil className="size-4" />
              Editar
            </Button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Ordem original</p>
            <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {command.instruction}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Mensagem de abertura</p>
            <Input
              value={greeting}
              onChange={(event) => setGreeting(event.target.value)}
              placeholder="Oi! Aqui é do time da [empresa]."
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Instruções</p>
            <Textarea
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              rows={14}
              placeholder="Regras de tom, o que nunca fazer, como tratar objeção..."
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Limites numéricos (desconto máximo, valor máximo) devem ficar em Auto
              Inteligência: lá eles viram trava de verdade, não só uma frase no prompt.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            {TEMPLATES.map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => applyTemplate(template.body)}
                className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
              >
                {template.label}
              </button>
            ))}
          </div>

          <Button
            onClick={() => handleSave()}
            disabled={update.isPending}
            className="h-11 rounded-xl"
          >
            {update.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar prompt
          </Button>
        </div>
      </div>

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent className="flex w-full flex-col gap-4 sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Instruções do comando</SheetTitle>
            <SheetDescription>
              Espaço maior para escrever. Nada é salvo até você aplicar.
            </SheetDescription>
          </SheetHeader>

          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-0 flex-1 rounded-xl"
          />

          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setSystemPrompt(draft);
                setEditorOpen(false);
                handleSave(draft);
              }}
            >
              Aplicar e salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
