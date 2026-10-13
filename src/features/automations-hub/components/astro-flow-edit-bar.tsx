"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useAtomValue } from "jotai";
import { ArrowUpIcon, SparklesIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useAstroWidgetStore } from "@/features/astro/voice/use-astro-widget-store";
import { buildPickedAnswer } from "@/features/astro/lib/astro-picker";
import { editorReadOnlyAtom, workflowDirtyAtom } from "@/features/editor/store/atoms";

// "Pedir ao ASTRO" dentro do editor de um fluxo (spec 0094, RF-2): o mesmo campo de "Criar fluxo com
// ASTRO", mas a mudança é pedida para o fluxo aberto. A conversa é a do Astro de sempre.

export const IS_ASTRO_FLOW_EDIT_ON = process.env.NEXT_PUBLIC_ASTRO_FLOW_EDIT === "true";
const MIN_REQUEST_CHARS = 10;
const EXAMPLES = ["Insira o envio da agenda depois da primeira mensagem", "Troque a espera para 2 horas", "Tire o último passo"];

export function AstroFlowEditBar({ workflowId }: { workflowId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editRequest, setEditRequest] = useState("");
  const hasUnsavedChanges = useAtomValue(workflowDirtyAtom);
  const isReadOnly = useAtomValue(editorReadOnlyAtom);
  const openAstro = useAstroWidgetStore((state) => state.open);

  function sendRequest(event?: FormEvent) {
    event?.preventDefault();
    const trimmedRequest = editRequest.trim();
    if (trimmedRequest.length < MIN_REQUEST_CHARS) return;
    // O Astro altera o fluxo salvo: com mudança pendente na tela, o "sim" passaria por cima dela.
    if (hasUnsavedChanges) {
      toast.error("Salve o fluxo antes de pedir ao Astro, para ele partir do que está na tela.");
      return;
    }
    // A referência vai no fim do texto, onde a conversa não a mostra.
    openAstro({ text: buildPickedAnswer(`Edite este fluxo: ${trimmedRequest}`, workflowId), fromVoice: false });
    setEditRequest("");
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) sendRequest(event);
    if (event.key === "Escape") setIsOpen(false);
  }

  if (!IS_ASTRO_FLOW_EDIT_ON || isReadOnly) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen((wasOpen) => !wasOpen)} data-guide={GUIDE_ANCHORS.astroFlowEditButton.id}>
        <SparklesIcon className="size-4 text-info" />
        <span className="hidden font-semibold sm:inline">Pedir ao ASTRO</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
          <form onSubmit={sendRequest} className="mx-auto w-full max-w-2xl rounded-3xl border bg-background p-3 shadow-2xl" data-guide={GUIDE_ANCHORS.astroFlowEditField.id}>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <SparklesIcon className="size-3.5 text-info" />
              <span className="flex-1">Diga o que mudar neste fluxo. O Astro pergunta o que faltar e mostra a mudança antes de gravar.</span>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Fechar" className="rounded-full p-1 hover:bg-muted">
                <XIcon className="size-3.5" />
              </button>
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                autoFocus
                value={editRequest}
                onChange={(event) => setEditRequest(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                maxLength={1500}
                placeholder="O que inserir, tirar ou trocar, e em que ponto"
                className="min-h-0 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button type="submit" size="icon" className="rounded-full" disabled={editRequest.trim().length < MIN_REQUEST_CHARS} aria-label="Enviar ao Astro">
                <ArrowUpIcon />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <button key={example} type="button" onClick={() => setEditRequest(example)} className="rounded-full bg-muted px-2.5 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground">
                  {example}
                </button>
              ))}
            </div>
          </form>
        </div>
      )}
    </>
  );
}
