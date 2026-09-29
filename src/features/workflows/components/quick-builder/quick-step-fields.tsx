"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useStatus } from "@/features/status/hooks/use-status";
import { useTags } from "@/features/tags/hooks/use-tags";
import type { QuickStep } from "@/features/workflows/lib/quick-builder/steps";

// Campos essenciais de cada passo do construtor rápido (spec 0039, RF-1). O
// que não cabe aqui fica para o modo avançado (nó marcado para revisão).

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const FIELD_CLASS = "h-8 text-xs";

type Data = Record<string, unknown>;

function readRecord(value: unknown): Data {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Data) : {};
}

function readString(record: Data, key: string, fallback = ""): string {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

interface QuickStepFieldsProps {
  step: QuickStep;
  trackingId: string;
  onChange: (data: Data) => void;
}

export function QuickStepFields({ step, trackingId, onChange }: QuickStepFieldsProps) {
  const { tags } = useTags({ trackingId });
  const { status: statuses } = useStatus(trackingId);
  const data = step.data;
  const action = readRecord(data.action);
  const setAction = (patch: Data) => onChange({ ...data, action: { ...action, ...patch } });

  switch (step.type) {
    case "SCHEDULE_TRIGGER": {
      const schedule = readRecord(data.schedule);
      const frequency = readString(schedule, "frequency", "DAILY");
      const weekdays = Array.isArray(schedule.weekdays) ? (schedule.weekdays as number[]) : [1, 2, 3, 4, 5];
      const setSchedule = (patch: Data) => onChange({ ...data, schedule: { ...schedule, ...patch } });
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={frequency} onValueChange={(value) => setSchedule({ frequency: value, ...(value === "WEEKDAYS" ? { weekdays } : {}) })}>
              <SelectTrigger size="sm" className={FIELD_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Todo dia</SelectItem>
                <SelectItem value="WEEKDAYS">Dias da semana</SelectItem>
                <SelectItem value="ONCE">Uma vez</SelectItem>
              </SelectContent>
            </Select>
            {frequency === "ONCE" && (
              <Input type="date" value={readString(schedule, "date")} onChange={(event) => setSchedule({ date: event.target.value })} className={cn(FIELD_CLASS, "w-36")} />
            )}
            <span className="text-xs text-muted-foreground">às</span>
            <Input type="time" value={readString(schedule, "time", "09:00")} onChange={(event) => setSchedule({ time: event.target.value })} className={cn(FIELD_CLASS, "w-24")} />
          </div>
          {frequency === "WEEKDAYS" && (
            <div className="flex flex-wrap gap-1">
              {WEEKDAY_LABELS.map((label, weekday) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    setSchedule({
                      weekdays: weekdays.includes(weekday) ? weekdays.filter((day) => day !== weekday) : [...weekdays, weekday].sort(),
                    })
                  }
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    weekdays.includes(weekday) ? "bg-foreground text-background" : "bg-foreground/5 text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    case "LEAD_TAGGED":
    case "TAG": {
      const key = step.type === "LEAD_TAGGED" ? "tagIds" : "tagsIds";
      const selectedIds = Array.isArray(action[key]) ? (action[key] as string[]) : [];
      return (
        <div className="flex flex-col gap-1.5">
          {step.type === "TAG" && (
            <Select value={readString(action, "type", "ADD")} onValueChange={(value) => setAction({ type: value })}>
              <SelectTrigger size="sm" className={cn(FIELD_CLASS, "w-40")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADD">Adicionar tag</SelectItem>
                <SelectItem value="REMOVE">Remover tag</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
            {tags.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma tag neste tracking.</span>}
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() =>
                  setAction({
                    [key]: selectedIds.includes(tag.id) ? selectedIds.filter((id) => id !== tag.id) : [...selectedIds, tag.id],
                  })
                }
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  selectedIds.includes(tag.id) ? "bg-foreground text-background" : "bg-foreground/5 text-muted-foreground",
                )}
              >
                {tag.name}
              </button>
            ))}
            {selectedIds
              .filter((id) => id.startsWith("{{TAG:"))
              .map((placeholder) => (
                <span key={placeholder} className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-500">
                  nova: {placeholder.slice(6, -2).split(":")[0]}
                </span>
              ))}
          </div>
        </div>
      );
    }

    case "MOVE_LEAD_STATUS":
    case "MOVE_LEAD":
      return (
        <Select value={readString(action, "statusId") || undefined} onValueChange={(value) => setAction({ statusId: value })}>
          <SelectTrigger size="sm" className={cn(FIELD_CLASS, "w-56")}>
            <SelectValue placeholder="Escolha a etapa" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((status) => (
              <SelectItem key={status.id} value={status.id}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "SEND_MESSAGE": {
      const payload = readRecord(action.payload);
      return (
        <Textarea
          rows={2}
          value={readString(payload, "message")}
          onChange={(event) => setAction({ payload: { ...payload, type: "TEXT", message: event.target.value } })}
          placeholder="Oi, {{lead.name}}!"
          className="min-h-0 resize-none text-xs"
        />
      );
    }

    case "NOTIFY_TEAM":
      return (
        <div className="flex flex-col gap-1.5">
          <Select value={readString(data, "target", "USER")} onValueChange={(value) => onChange({ ...data, target: value })}>
            <SelectTrigger size="sm" className={cn(FIELD_CLASS, "w-52")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">Lembrar a mim</SelectItem>
              <SelectItem value="RESPONSIBLE">Lembrar o responsável do lead</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            rows={2}
            value={readString(data, "message")}
            onChange={(event) => onChange({ ...data, message: event.target.value })}
            placeholder="Retornar para {{lead.name}}"
            className="min-h-0 resize-none text-xs"
          />
        </div>
      );

    case "WAIT": {
      const unit = readString(action, "type", "days");
      const amount = Number(action[unit] ?? 1);
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={amount}
            onChange={(event) => setAction({ [unit]: Math.max(1, Number(event.target.value) || 1) })}
            className={cn(FIELD_CLASS, "w-20")}
          />
          <Select value={unit} onValueChange={(value) => setAction({ type: value, [value]: amount })}>
            <SelectTrigger size="sm" className={cn(FIELD_CLASS, "w-28")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">minutos</SelectItem>
              <SelectItem value="hours">horas</SelectItem>
              <SelectItem value="days">dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    case "WAIT_FOR_EVENT":
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Espera a resposta do lead por até
          <Input
            type="number"
            min={1}
            value={Math.round(Number(data.timeoutMinutes ?? 1440) / 60)}
            onChange={(event) => onChange({ ...data, timeoutMinutes: Math.max(1, Number(event.target.value) || 1) * 60 })}
            className={cn(FIELD_CLASS, "w-20")}
          />
          horas
        </div>
      );

    case "SEND_VOICE":
      return (
        <Textarea
          rows={2}
          value={readString(data, "text")}
          onChange={(event) => onChange({ ...data, text: event.target.value })}
          className="min-h-0 resize-none text-xs"
        />
      );

    case "SEND_EMAIL":
      return (
        <div className="flex flex-col gap-1.5">
          <Input value={readString(action, "subject")} onChange={(event) => setAction({ subject: event.target.value })} placeholder="Assunto" className={FIELD_CLASS} />
          <Textarea rows={2} value={readString(action, "html")} onChange={(event) => setAction({ html: event.target.value })} placeholder="Texto do e-mail" className="min-h-0 resize-none text-xs" />
        </div>
      );

    case "SET_VARIABLE":
      return (
        <div className="flex items-center gap-2">
          <Input value={readString(data, "name")} onChange={(event) => onChange({ ...data, name: event.target.value })} placeholder="nome" className={cn(FIELD_CLASS, "w-32")} />
          <span className="text-xs text-muted-foreground">=</span>
          <Input value={readString(data, "value")} onChange={(event) => onChange({ ...data, value: event.target.value })} placeholder="valor" className={FIELD_CLASS} />
        </div>
      );

    case "AI_GENERATE_TEXT":
      return (
        <Textarea
          rows={2}
          value={readString(data, "prompt")}
          onChange={(event) => onChange({ ...data, prompt: event.target.value })}
          placeholder="O que a IA deve escrever?"
          className="min-h-0 resize-none text-xs"
        />
      );

    case "WEB_SEARCH":
      return <Input value={readString(data, "query")} onChange={(event) => onChange({ ...data, query: event.target.value })} placeholder="O que pesquisar?" className={FIELD_CLASS} />;

    default:
      return data.needsReview ? (
        <p className="text-xs text-amber-500">{readString(data, "reviewReason", "Complete este passo no modo avançado.")}</p>
      ) : null;
  }
}
