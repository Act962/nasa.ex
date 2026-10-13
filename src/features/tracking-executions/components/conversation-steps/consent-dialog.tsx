"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { CONSENT_TYPE, DEFAULT_CONSENT_PAYLOAD, DEFAULT_STEP_REPLY_TIMEOUT_MINUTES, type ConsentPayload } from "@/features/workflows/lib/conversation-steps";

// Configuração do passo "Pedir aceite" (spec 0099, parte B): o texto dos termos, o link da política
// e os dois botões. O aceite fica registrado no lead, com data.

const BUTTON_LABEL_MAX_CHARS = 20;
const TERMS_MAX_CHARS = 900;

export function ConsentDialog({
  open,
  onOpenChange,
  defaultPayload,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPayload?: Partial<ConsentPayload>;
  onSubmit: (payload: ConsentPayload) => void;
}) {
  const [payload, setPayload] = useState<ConsentPayload>({ ...DEFAULT_CONSENT_PAYLOAD, ...defaultPayload, type: CONSENT_TYPE });
  useEffect(() => {
    if (open) setPayload({ ...DEFAULT_CONSENT_PAYLOAD, ...defaultPayload, type: CONSENT_TYPE });
    // Só ao abrir: enquanto a pessoa edita, o que vale é o que ela digitou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const change = <TKey extends keyof ConsentPayload>(key: TKey, value: ConsentPayload[TKey]) => setPayload((current) => ({ ...current, [key]: value }));
  const canSave = payload.termsText.trim().length > 0 && payload.acceptLabel.trim().length > 0 && payload.refuseLabel.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-node-config className="max-w-lg" data-guide={GUIDE_ANCHORS.workflowConsentStep.id}>
        <DialogHeader>
          <DialogTitle>Pedir aceite</DialogTitle>
          <DialogDescription>O cliente lê os termos e responde por botão. O aceite fica registrado no lead, com a data e o texto apresentado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="consent-terms">Texto dos termos</Label>
            <Textarea id="consent-terms" rows={5} maxLength={TERMS_MAX_CHARS} value={payload.termsText} onChange={(event) => change("termsText", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="consent-policy">Link da política de privacidade (opcional)</Label>
            <Input id="consent-policy" placeholder="https://suaempresa.com.br/politica-de-privacidade" value={payload.policyUrl} onChange={(event) => change("policyUrl", event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="consent-accept">Botão de aceite</Label>
              <Input id="consent-accept" maxLength={BUTTON_LABEL_MAX_CHARS} value={payload.acceptLabel} onChange={(event) => change("acceptLabel", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consent-refuse">Botão de recusa</Label>
              <Input id="consent-refuse" maxLength={BUTTON_LABEL_MAX_CHARS} value={payload.refuseLabel} onChange={(event) => change("refuseLabel", event.target.value)} />
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>
              Só pedir uma vez por cliente
              <span className="block text-xs text-muted-foreground">Quem já aceitou este mesmo texto segue direto.</span>
            </span>
            <Switch checked={payload.askOnce} onCheckedChange={(isChecked) => change("askOnce", isChecked)} />
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="consent-timeout">Esperar a resposta por (minutos)</Label>
            <Input
              id="consent-timeout"
              type="number"
              min={1}
              max={1440}
              value={payload.replyTimeoutMinutes}
              onChange={(event) => change("replyTimeoutMinutes", Number(event.target.value) || DEFAULT_STEP_REPLY_TIMEOUT_MINUTES)}
            />
            <p className="text-xs text-muted-foreground">Sem resposta nesse prazo, o fluxo segue por &quot;Recusou&quot;.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              onSubmit({ ...payload, termsText: payload.termsText.trim(), policyUrl: payload.policyUrl.trim() });
              onOpenChange(false);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
