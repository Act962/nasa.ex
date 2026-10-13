"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useQueryListForms } from "@/features/form/hooks/use-form";
import { DEFAULT_FORM_CHAT_PAYLOAD, DEFAULT_STEP_REPLY_TIMEOUT_MINUTES, FORM_CHAT_TYPE, type FormChatPayload } from "@/features/workflows/lib/conversation-steps";
import { listChatFields, type ChatField } from "@/features/workflows/lib/form-chat";

// Configuração do passo "Preencher formulário pela conversa" (spec 0099, parte A): qual formulário do
// Órbita Forms e quais campos dele são perguntados ao cliente, um a um.

const KIND_LABEL: Record<ChatField["kind"], string> = {
  text: "texto",
  masked: "com validação",
  choice: "opções",
  lookup: "lista longa",
  date: "data",
  number: "número",
};

const NO_FALLBACK = "__none__";

function kindLabelOf(field: ChatField): string {
  if (field.kind === "masked" && field.format) return { cpf: "CPF", "phone-br": "telefone", cep: "CEP", email: "e-mail", "city-uf": "cidade e UF" }[field.format];
  if (field.kind === "choice") return `opções · ${field.options?.length ?? 0}`;
  if (field.kind === "lookup") return `lista · ${field.inlineOptions?.length ?? 0} opções`;
  return KIND_LABEL[field.kind];
}

export function FormChatDialog({
  open,
  onOpenChange,
  defaultPayload,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPayload?: Partial<FormChatPayload>;
  onSubmit: (payload: FormChatPayload) => void;
}) {
  const [payload, setPayload] = useState<FormChatPayload>({ ...DEFAULT_FORM_CHAT_PAYLOAD, ...defaultPayload, type: FORM_CHAT_TYPE });
  useEffect(() => {
    if (open) setPayload({ ...DEFAULT_FORM_CHAT_PAYLOAD, ...defaultPayload, type: FORM_CHAT_TYPE });
    // Só ao abrir: enquanto a pessoa edita, o que vale é o que ela marcou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { forms, isLoading } = useQueryListForms({ enabled: open });
  const selectedForm = forms.find((form) => form.id === payload.formId);
  const fields = useMemo(() => (selectedForm ? listChatFields(selectedForm.jsonBlock) : []), [selectedForm]);
  const lookupFields = fields.filter((field) => field.kind === "lookup" && payload.fieldIds.includes(field.id));

  const toggleField = (fieldId: string, isChecked: boolean) =>
    setPayload((current) => ({
      ...current,
      // A ordem das perguntas segue a do formulário.
      fieldIds: fields.map((field) => field.id).filter((candidateId) => (candidateId === fieldId ? isChecked : current.fieldIds.includes(candidateId))),
    }));

  const canSave = Boolean(selectedForm) && payload.fieldIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-node-config className="max-h-[85vh] max-w-lg overflow-y-auto" data-guide={GUIDE_ANCHORS.workflowFormChatStep.id}>
        <DialogHeader>
          <DialogTitle>Preencher formulário pela conversa</DialogTitle>
          <DialogDescription>O cliente responde no WhatsApp, uma pergunta por vez. No fim, a resposta e a ficha ficam gravadas no lead, como num envio normal do formulário.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Formulário</Label>
            <Select value={payload.formId} onValueChange={(formId) => setPayload((current) => ({ ...current, formId, fieldIds: [], fallbackOptionByField: {} }))}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Carregando…" : "Escolha um formulário do Órbita Forms"} />
              </SelectTrigger>
              <SelectContent>
                {forms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoading && forms.length === 0 && <p className="text-xs text-muted-foreground">Nenhum formulário ainda. Crie um no Órbita Forms e volte aqui.</p>}
          </div>

          {selectedForm && (
            <div className="space-y-1.5">
              <Label>Campos a perguntar, na ordem do formulário</Label>
              {fields.length === 0 ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Este formulário não tem campo que dê para perguntar pela conversa. Valem: texto, campo com validação (CPF, telefone, e-mail, CEP), opções, lista, data e nota.
                </p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {fields.map((field) => (
                    <label key={field.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm">
                      <Checkbox checked={payload.fieldIds.includes(field.id)} onCheckedChange={(isChecked) => toggleField(field.id, isChecked === true)} />
                      <span className="min-w-0 flex-1 truncate">{field.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{kindLabelOf(field)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {lookupFields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label>Se o cliente digitar algo fora da lista de &quot;{field.label}&quot;, oferecer</Label>
              <Select
                value={payload.fallbackOptionByField[field.id] ?? NO_FALLBACK}
                onValueChange={(option) =>
                  setPayload((current) => {
                    const fallbackOptionByField = { ...current.fallbackOptionByField };
                    if (option === NO_FALLBACK) delete fallbackOptionByField[field.id];
                    else fallbackOptionByField[field.id] = option;
                    return { ...current, fallbackOptionByField };
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FALLBACK}>Só &quot;Digitar novamente&quot; e &quot;Falar com atendente&quot;</SelectItem>
                  {(field.inlineOptions ?? []).slice(0, 200).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>
              Perguntar só o que falta
              <span className="block text-xs text-muted-foreground">Nome, e-mail, telefone e CPF que o lead já tem não são perguntados de novo.</span>
            </span>
            <Switch checked={payload.askOnlyMissing} onCheckedChange={(isChecked) => setPayload((current) => ({ ...current, askOnlyMissing: isChecked }))} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>
              Mostrar resumo e pedir confirmação
              <span className="block text-xs text-muted-foreground">O cliente confere os dados e pode corrigir um deles antes de gravar.</span>
            </span>
            <Switch checked={payload.showSummary} onCheckedChange={(isChecked) => setPayload((current) => ({ ...current, showSummary: isChecked }))} />
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="form-chat-timeout">Esperar cada resposta por (minutos)</Label>
            <Input
              id="form-chat-timeout"
              type="number"
              min={1}
              max={1440}
              value={payload.replyTimeoutMinutes}
              onChange={(event) => setPayload((current) => ({ ...current, replyTimeoutMinutes: Number(event.target.value) || DEFAULT_STEP_REPLY_TIMEOUT_MINUTES }))}
            />
            <p className="text-xs text-muted-foreground">Sem resposta nesse prazo, o fluxo segue por &quot;Desistiu&quot; e nada é gravado como ficha.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              onSubmit(payload);
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
