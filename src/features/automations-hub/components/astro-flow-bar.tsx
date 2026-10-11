"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUpIcon, SparklesIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAstroWidgetStore } from "@/features/astro/voice/use-astro-widget-store";
import { useAutomationsOverview } from "@/features/automations-hub/hooks/use-automations-hub";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { IS_ASTRO_FLOW_EDIT_ON } from "./astro-flow-edit-bar";

// "Criar fluxo com ASTRO" (spec 0090, RF-22): o botão abre um campo de mensagem preso na base da
// página. O pedido segue para a conversa do Astro, que mostra o roteiro e pede confirmação.

const ASKS_TO_EDIT = /\b(n?es[st]e fluxo|no fluxo|do fluxo)\b/i;
const ASKS_TO_CREATE = /\b(crie|criar|cria|monte|montar|gere|gerar)\b/i;

const EXAMPLES = [
  "Quando o lead receber a tag Orçamento, enviar boas-vindas e lembrar em 2 horas se não responder",
  "Quando entrar um lead novo, avisar o responsável e mover para Em atendimento",
];

interface AstroFlowBarProps {
  /** Funil em que a pessoa está, quando houver: o Astro não precisa perguntar. */
  trackingId?: string;
}

export function AstroFlowBar({ trackingId }: AstroFlowBarProps) {
  const { data: overview } = useAutomationsOverview();
  const trackingName = overview?.trackings.find((tracking) => tracking.id === trackingId)?.name;
  const [isOpen, setIsOpen] = useState(false);
  const [flowRequest, setFlowRequest] = useState("");
  const openAstro = useAstroWidgetStore((state) => state.open);

  function sendRequest(event?: FormEvent) {
    event?.preventDefault();
    const trimmedRequest = flowRequest.trim();
    if (trimmedRequest.length < 10) return;
    const target = trackingName ? ` no funil "${trackingName}"` : "";
    // "Insira agendamento nesse fluxo" não é criar: o Astro pergunta qual fluxo (spec 0094, RF-3).
    const isEditRequest = IS_ASTRO_FLOW_EDIT_ON && ASKS_TO_EDIT.test(trimmedRequest) && !ASKS_TO_CREATE.test(trimmedRequest);
    const opening = isEditRequest ? `Edite um fluxo${target}` : `Crie um fluxo de automação${target}`;
    openAstro({ text: `${opening}: ${trimmedRequest}`, fromVoice: false });
    setFlowRequest("");
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) sendRequest(event);
    if (event.key === "Escape") setIsOpen(false);
  }

  if (!overview?.canCreateTrackingFlow) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        data-guide={GUIDE_ANCHORS.astroFlowButton.id}
      >
        <SparklesIcon className="size-4 text-info" />
        <span className="hidden font-semibold sm:inline">Criar fluxo com ASTRO</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
          <form
            onSubmit={sendRequest}
            className="mx-auto w-full max-w-2xl rounded-3xl border bg-background p-3 shadow-2xl"
            data-guide={GUIDE_ANCHORS.astroFlowField.id}
          >
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <SparklesIcon className="size-3.5 text-info" />
              <span className="flex-1">
                Descreva o fluxo{trackingName ? ` para ${trackingName}` : ""}. O Astro mostra o roteiro e cria desligado.
              </span>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Fechar" className="rounded-full p-1 hover:bg-muted">
                <XIcon className="size-3.5" />
              </button>
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                autoFocus
                value={flowRequest}
                onChange={(event) => setFlowRequest(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                maxLength={1500}
                placeholder="Quando começa, o que envia ou muda, e os prazos"
                className="min-h-0 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button type="submit" size="icon" className="rounded-full" disabled={flowRequest.trim().length < 10} aria-label="Enviar ao Astro">
                <ArrowUpIcon />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setFlowRequest(example)}
                  className="rounded-full bg-muted px-2.5 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground"
                >
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
