"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AttendanceSettings } from "@/features/tracking-chat-ai/lib/capabilities";

// Estado de atendimento por funil (spec 0113, RF-7): quem responde primeiro, tempos e textos fixos.
const FIRST_RESPONDER_OPTIONS: { value: AttendanceSettings["firstResponder"]; title: string; description: string }[] = [
  {
    value: "AI",
    title: "IA primeiro",
    description: "A IA responde na hora. A equipe assume quando quiser, e a IA se cala enquanto um atendente conversa.",
  },
  {
    value: "TEAM",
    title: "Equipe primeiro",
    description: "Sem resposta da equipe, sai a mensagem fixa e, depois do tempo abaixo, a IA entra e o dono é avisado.",
  },
];

const MINUTE_FIELDS: { key: "holdingMinutes" | "aiStepInMinutes" | "inServiceAiMinutes" | "ownerNoticeMinutes"; label: string; min: number; max: number }[] = [
  { key: "holdingMinutes", label: "Mensagem fixa após (min)", min: 1, max: 30 },
  { key: "aiStepInMinutes", label: "IA entra depois de mais (min)", min: 1, max: 60 },
  { key: "inServiceAiMinutes", label: "IA continua se o atendente sumir (min)", min: 2, max: 120 },
  { key: "ownerNoticeMinutes", label: "Intervalo dos avisos ao dono (min)", min: 5, max: 120 },
];

interface AttendanceSettingsSectionProps {
  value: AttendanceSettings;
  onChange: (next: AttendanceSettings) => void;
}

export function AttendanceSettingsSection({ value, onChange }: AttendanceSettingsSectionProps) {
  const update = <Key extends keyof AttendanceSettings>(key: Key, fieldValue: AttendanceSettings[Key]) =>
    onChange({ ...value, [key]: fieldValue });

  return (
    <section>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Atendimento</h3>
      <div className="mt-2 grid gap-3 rounded-lg border p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {FIRST_RESPONDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => update("firstResponder", option.value)}
              className={cn(
                "rounded-md border p-3 text-left transition-colors",
                value.firstResponder === option.value ? "border-primary bg-primary/5" : "hover:bg-muted/50",
              )}
            >
              <p className="text-sm font-medium">{option.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {MINUTE_FIELDS.map((field) => (
            <label key={field.key} className="grid gap-1 text-xs text-muted-foreground">
              {field.label}
              <Input
                type="number"
                min={field.min}
                max={field.max}
                value={value[field.key]}
                onChange={(event) => {
                  const minutes = Number(event.target.value);
                  if (Number.isFinite(minutes)) update(field.key, Math.min(field.max, Math.max(field.min, Math.round(minutes))));
                }}
              />
            </label>
          ))}
        </div>

        <label className="grid gap-1 text-xs text-muted-foreground">
          Mensagem fixa (sem IA), quando a equipe demora
          <Textarea rows={2} maxLength={300} value={value.holdingText} onChange={(event) => update("holdingText", event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Mensagem de espera, quando o cliente pede um atendente
          <Textarea rows={2} maxLength={300} value={value.handoffText} onChange={(event) => update("handoffText", event.target.value)} />
        </label>
        <p className="text-xs text-muted-foreground">
          Use {"{{primeiro_nome}}"} para chamar o cliente pelo nome. Fluxos e lembretes seguem sempre, com a IA falando ou não.
        </p>
      </div>
    </section>
  );
}
