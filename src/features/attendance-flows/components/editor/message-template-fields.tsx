"use client";

// Template aprovado no bloco Enviar mensagem (spec 0144): "sempre como template" ou template reserva para quando a
// janela de 24h estiver fechada. Só aparece com número da API oficial no fluxo.
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { WorkflowTemplateFields, type WorkflowTemplateSelection } from "@/features/tracking-executions/components/send-message/template-fields";

export interface OfficialNumber {
  trackingId: string;
  name: string;
  wabaId: string | null;
}

export type SendWindowMode = "window" | "template";

export function SendWindowModeSelect({ value, onChange }: { value: SendWindowMode; onChange: (mode: SendWindowMode) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Enviar</span>
      <Select value={value} onValueChange={(mode) => onChange(mode as SendWindowMode)}>
        <SelectTrigger size="sm" className="h-8 flex-1 border-dashed text-xs font-medium text-primary">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="window">dentro da janela de 24h</SelectItem>
          <SelectItem value="template">sempre como template aprovado</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/** Seletor de template de um número oficial do fluxo. Template é da conta da Meta, por isso a lista é por número (D-2). */
export function FlowTemplatePicker({
  numbers,
  value,
  onChange,
}: {
  numbers: OfficialNumber[];
  value: Partial<WorkflowTemplateSelection> | null;
  onChange: (selection: WorkflowTemplateSelection) => void;
}) {
  const [trackingId, setTrackingId] = useState(numbers[0]?.trackingId ?? "");
  const hasSeveralAccounts = new Set(numbers.map((number) => number.wabaId ?? number.trackingId)).size > 1;
  if (!trackingId) return null;
  return (
    <div className="space-y-2">
      {numbers.length > 1 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Templates do número</Label>
          <Select value={trackingId} onValueChange={setTrackingId}>
            <SelectTrigger size="sm" className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {numbers.map((number) => (
                <SelectItem key={number.trackingId} value={number.trackingId}>
                  {number.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <WorkflowTemplateFields
        trackingId={trackingId}
        value={value}
        onChange={onChange}
        showValidation
        isCompact
        parameterPlaceholder="Texto ou variável, ex.: {{nome}}"
        renderParameterInput={(inputProps) => (
          <Input
            value={inputProps.value}
            onChange={(event) => inputProps.onChange(event.target.value)}
            placeholder={inputProps.placeholder}
            aria-invalid={inputProps.isInvalid}
            className="h-8 text-xs"
          />
        )}
      />
      {hasSeveralAccounts && (
        <p className="text-[11px] text-destructive">
          Os números deste fluxo são de contas diferentes da Meta. O template precisa existir com o mesmo nome em cada uma, senão o
          envio falha no número que não tiver.
        </p>
      )}
    </div>
  );
}

/** Chave do template reserva: vai no lugar da mensagem quando o cliente não escreve há mais de 24h. */
export function FallbackTemplateSection({
  numbers,
  value,
  onChange,
}: {
  numbers: OfficialNumber[];
  value: Partial<WorkflowTemplateSelection> | null;
  onChange: (selection: Partial<WorkflowTemplateSelection> | null) => void;
}) {
  const isEnabled = Boolean(value);
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <label className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Se a janela de 24h estiver fechada</span>
        <Switch checked={isEnabled} onCheckedChange={(checked) => onChange(checked ? { templateName: "", languageCode: "" } : null)} />
      </label>
      {isEnabled ? (
        <FlowTemplatePicker numbers={numbers} value={value} onChange={onChange} />
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Sem template, a mensagem não sai quando o cliente não escreve há mais de 24h, e o fluxo para aqui para esse cliente. Ligue para enviar um
          template aprovado no lugar.
        </p>
      )}
    </div>
  );
}
