"use client";

// "Enviar cobrança agora": escolhe um aviso de uma régua e manda na hora, com o link e o PIX
// gerados no momento do envio.

import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { useDunningRules, useSendDunningNow } from "../../hooks/use-payment-dunning";
import { describeTiming } from "../../lib/dunning-presets";
import { describePaymentError } from "../../lib/describe-error";
import { DUNNING_CHANNEL_META } from "./dunning-channel-meta";

export interface DunningSendNowTarget {
  id: string;
  name: string;
  ruleId: string | null;
}


export function DunningSendNowDialog({
  entry,
  onClose,
}: {
  entry: DunningSendNowTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent scrollable className="sm:max-w-lg">
        {entry && <SendNowContent key={entry.id} entry={entry} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function SendNowContent({ entry, onClose }: { entry: DunningSendNowTarget; onClose: () => void }) {
  const { data: rulesData, isLoading } = useDunningRules();
  const sendNow = useSendDunningNow();

  // A régua da conta vem primeiro; SMS ainda não é enviado.
  const rules = (rulesData?.rules ?? [])
    .filter((rule) => rule.isActive)
    .map((rule) => ({
      ...rule,
      steps: rule.steps.filter((step) => step.enabled && step.channel !== "SMS"),
    }))
    .filter((rule) => rule.steps.length > 0)
    .sort((ruleA, ruleB) => Number(ruleB.id === entry.ruleId) - Number(ruleA.id === entry.ruleId));

  const [chosenStepId, setChosenStepId] = useState<string | null>(null);
  const selectedStepId = chosenStepId ?? rules[0]?.steps[0]?.id ?? null;
  const selectedStep = rules.flatMap((rule) => rule.steps).find((step) => step.id === selectedStepId) ?? null;

  function handleSend() {
    if (!selectedStep) return;
    sendNow.mutate(
      { entryId: entry.id, stepId: selectedStep.id },
      {
        onSuccess: ({ channel }) => {
          toast.success(
            `Cobrança saindo por ${channel === "EMAIL" ? "e-mail" : "WhatsApp"}. Confirme no histórico de avisos em instantes.`,
          );
          onClose();
        },
        onError: (error) => toast.error(describePaymentError(error, "Não foi possível enviar a cobrança")),
      },
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Enviar cobrança agora</DialogTitle>
        <DialogDescription>
          &quot;{entry.name}&quot;. Escolha o aviso: ele sai na hora, com o link e o PIX gerados agora.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <OrbitaSpinner className="size-5" />
          </div>
        ) : rules.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma régua ativa com aviso. Crie uma em Cobranças → Réguas e mensagens.
          </p>
        ) : (
          rules.map((rule) => (
            <section key={rule.id} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {rule.name}
                {rule.id === entry.ruleId && " · régua desta conta"}
              </p>
              <div role="radiogroup" aria-label={rule.name} className="space-y-1.5">
                {rule.steps.map((step) => {
                  const channel = DUNNING_CHANNEL_META[step.channel];
                  const isSelected = step.id === selectedStepId;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setChosenStepId(step.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        isSelected ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded-full border",
                          isSelected ? "border-primary" : "border-muted-foreground/50",
                        )}
                      >
                        {isSelected && <span className="size-2 rounded-full bg-primary" />}
                      </span>
                      <span className="flex-1">{describeTiming(step.daysOffset)}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <channel.Icon className="size-3.5" />
                        {channel.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}

        {selectedStep && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Texto do aviso</p>
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed">
              {selectedStep.templateBody}
            </p>
            {selectedStep.channel === "WHATSAPP" && selectedStep.whatsappTemplateName && (
              <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning">
                No número oficial, se o cliente não falou com a empresa nas últimas 24 horas, a Meta só deixa
                enviar o modelo aprovado &quot;{selectedStep.whatsappTemplateName}&quot;: é ele que o cliente recebe,
                não este texto.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Os campos entre chaves são preenchidos com os dados desta conta. Os avisos agendados da régua
              continuam valendo, mas hoje não sai outro para esta conta.
            </p>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={sendNow.isPending}>
          Cancelar
        </Button>
        <Button onClick={handleSend} disabled={!selectedStep || sendNow.isPending} className="min-w-36 gap-2">
          {sendNow.isPending ? <OrbitaSpinner className="size-4" /> : <Send className="size-4" />}
          Enviar agora
        </Button>
      </DialogFooter>
    </>
  );
}
