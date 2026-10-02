"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDownIcon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSaveLeadTrigger } from "@/features/leads/hooks/use-lead-triggers";
import { useTags } from "@/features/tags/hooks/use-tags";
import {
  LEAD_NAME_PLACEHOLDER,
  LEAD_TRIGGER_INTERVAL_OPTIONS,
  LEAD_TRIGGER_REPETITION_OPTIONS,
  WEEKDAY_LABELS,
  hasLeadNamePlaceholder,
  type LeadTriggerTemplate,
} from "@/features/leads/lib/triggers/templates";
import { TriggerIcon } from "./trigger-icon";
import { TriggerDateTimePicker } from "./trigger-date-time-picker";
import { TriggerMessageInput } from "./trigger-message-input";
import { LightRunBorder } from "./light-run-border";

// Card-modelo do Gatilho do lead (spec 0038, RF-3): cinza desligado, verde
// ligado; toggle, contador, data, repetição, mensagem e período de ativação.

export interface SavedLeadTrigger {
  isActive: boolean;
  message: string;
  scheduledAt: Date | string | null;
  windowStart: string;
  windowEnd: string;
  weekdays: number[];
  skipWhenInService: boolean;
  repeatEveryDays: number | null;
  maxRepetitions: number;
  cycleFireCount: number;
  tagIds: string[];
  activationCount: number;
  lastFiredAt: Date | string | null;
  lastError: string | null;
}

interface LeadTriggerCardProps {
  leadId: string;
  trackingId: string;
  template: LeadTriggerTemplate;
  saved: SavedLeadTrigger | undefined;
}

const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];
const DEFAULT_INTERVAL_DAYS = 2;

function toDate(value: Date | string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function defaultScheduledAt(offsetDays: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(9, 0, 0, 0);
  return date;
}

export function LeadTriggerCard({ leadId, trackingId, template, saved }: LeadTriggerCardProps) {
  const saveTrigger = useSaveLeadTrigger(leadId);
  const { tags } = useTags({ trackingId });
  const [message, setMessage] = useState(saved?.message ?? template.defaultMessage);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(toDate(saved?.scheduledAt));
  const [maxRepetitions, setMaxRepetitions] = useState(saved?.maxRepetitions ?? 1);
  const [repeatEveryDays, setRepeatEveryDays] = useState<number>(saved?.repeatEveryDays ?? DEFAULT_INTERVAL_DAYS);
  const [windowStart, setWindowStart] = useState(saved?.windowStart ?? "08:00");
  const [windowEnd, setWindowEnd] = useState(saved?.windowEnd ?? "18:00");
  const [weekdays, setWeekdays] = useState<number[]>(saved?.weekdays ?? DEFAULT_WEEKDAYS);
  const [skipWhenInService, setSkipWhenInService] = useState(saved?.skipWhenInService ?? true);
  const [tagIds, setTagIds] = useState<string[]>(saved?.tagIds ?? []);
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);

  const isActive = saved?.isActive ?? false;
  const isMessageValid = hasLeadNamePlaceholder(message);
  const isRepeating = maxRepetitions > 1;
  const isDirty =
    message !== (saved?.message ?? template.defaultMessage) ||
    scheduledAt?.getTime() !== toDate(saved?.scheduledAt)?.getTime() ||
    maxRepetitions !== (saved?.maxRepetitions ?? 1) ||
    (isRepeating && repeatEveryDays !== (saved?.repeatEveryDays ?? DEFAULT_INTERVAL_DAYS)) ||
    windowStart !== (saved?.windowStart ?? "08:00") ||
    windowEnd !== (saved?.windowEnd ?? "18:00") ||
    weekdays.join() !== (saved?.weekdays ?? DEFAULT_WEEKDAYS).join() ||
    skipWhenInService !== (saved?.skipWhenInService ?? true) ||
    tagIds.join() !== (saved?.tagIds ?? []).join();

  const persist = (nextIsActive: boolean, nextScheduledAt: Date | null = scheduledAt) => {
    if (!isMessageValid) {
      toast.error(`A mensagem precisa ter ${LEAD_NAME_PLACEHOLDER} — é onde entra o nome do lead.`);
      return;
    }
    saveTrigger.mutate(
      {
        leadId,
        template: template.key,
        message,
        isActive: nextIsActive,
        scheduledAt: nextScheduledAt ? nextScheduledAt.toISOString() : null,
        windowStart,
        windowEnd,
        weekdays,
        skipWhenInService,
        maxRepetitions,
        repeatEveryDays: isRepeating ? repeatEveryDays : null,
        tagIds,
      },
      {
        onSuccess: () => toast.success(nextIsActive ? `${template.title} ligado.` : `${template.title} salvo.`),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const toggleActive = (nextIsActive: boolean) => {
    // Ligar sem data: usa a sugestão do modelo, às 9h.
    const nextScheduledAt = nextIsActive && !scheduledAt ? defaultScheduledAt(template.defaultOffsetDays) : scheduledAt;
    if (nextScheduledAt !== scheduledAt) setScheduledAt(nextScheduledAt);
    persist(nextIsActive, nextScheduledAt);
  };

  const toggleWeekday = (weekday: number) =>
    setWeekdays((current) =>
      current.includes(weekday) ? current.filter((day) => day !== weekday) : [...current, weekday].sort(),
    );

  const toggleTag = (tagId: string) =>
    setTagIds((current) => (current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]));

  const tone = isActive
    ? {
        card: "bg-gradient-to-br from-success to-success text-white",
        surface: "bg-white/10 text-white hover:bg-white/20",
        muted: "text-white/70",
        accent: "bg-white text-success",
        chipIdle: "bg-white/10 text-white/70 hover:bg-white/20",
        switch: "data-[state=checked]:bg-success",
      }
    : {
        card: "bg-card text-foreground",
        surface: "bg-foreground/5 text-foreground hover:bg-foreground/10",
        muted: "text-muted-foreground",
        accent: "bg-foreground text-background",
        chipIdle: "bg-foreground/5 text-muted-foreground hover:bg-foreground/10",
        switch: "data-[state=unchecked]:bg-foreground/20",
      };
  const selectTriggerClass = cn("h-8 w-auto gap-1.5 rounded-lg border-0 px-2.5 text-xs shadow-none", tone.surface);

  const selectedTagNames = tags.filter((tag) => tagIds.includes(tag.id)).map((tag) => tag.name);
  const periodSummary = [
    `${windowStart}–${windowEnd}`,
    weekdays.length === 7 ? "todos os dias" : weekdays.map((day) => WEEKDAY_LABELS[day]).join(", ") || "nenhum dia",
    selectedTagNames.length ? `tags: ${selectedTagNames.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Lógica quebrada: erro no último disparo, mensagem sem {nome} ou nenhum dia aberto.
  const hasProblem = Boolean(saved?.lastError) || !isMessageValid || weekdays.length === 0;
  const borderTone = hasProblem ? "error" : isActive ? "active" : "idle";

  return (
    <LightRunBorder tone={borderTone} innerClassName={tone.card}>
    <article className="flex flex-col gap-2.5 p-3.5">
      <header className="flex items-center gap-2.5">
        <TriggerIcon
          key={isActive ? "on" : "off"}
          className={cn(
            "size-4 shrink-0",
            isActive ? "text-success animate-in fade-in zoom-in-50 duration-500" : "text-muted-foreground",
          )}
          isSpinning={isActive}
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight">{template.title}</h3>
          <p className={cn("truncate text-[11px]", tone.muted)}>
            {saved?.activationCount ?? 0}× ativado
            {isActive && isRepeating && ` · ${saved?.cycleFireCount ?? 0} de ${maxRepetitions} neste ciclo`}
            {saved?.lastFiredAt && ` · último ${format(new Date(saved.lastFiredAt), "dd/MM HH:mm", { locale: ptBR })}`}
          </p>
        </div>
        <Switch
          checked={isActive}
          disabled={saveTrigger.isPending}
          onCheckedChange={toggleActive}
          className={tone.switch}
          aria-label={`Ligar ${template.title}`}
        />
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        <TriggerDateTimePicker value={scheduledAt} onChange={setScheduledAt} surfaceClassName={tone.surface} />
        <Select value={String(maxRepetitions)} onValueChange={(value) => setMaxRepetitions(Number(value))}>
          <SelectTrigger size="sm" className={selectTriggerClass} aria-label="Quantas vezes repetir">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_TRIGGER_REPETITION_OPTIONS.map((repetitions) => (
              <SelectItem key={repetitions} value={String(repetitions)}>
                {repetitions}x
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isRepeating && (
          <Select value={String(repeatEveryDays)} onValueChange={(value) => setRepeatEveryDays(Number(value))}>
            <SelectTrigger size="sm" className={selectTriggerClass} aria-label="A cada quantos dias">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_TRIGGER_INTERVAL_OPTIONS.map((option) => (
                <SelectItem key={option.days} value={String(option.days)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <TriggerMessageInput
        value={message}
        onChange={setMessage}
        hasError={!isMessageValid}
        surfaceClassName={tone.surface}
        hintClassName={tone.muted}
      />

      <button
        type="button"
        onClick={() => setIsPeriodOpen((current) => !current)}
        className={cn("flex items-center justify-between gap-2 text-left text-[11px]", tone.muted)}
      >
        <span className="truncate">Período: {periodSummary}</span>
        <ChevronDownIcon className={cn("size-3.5 shrink-0 transition-transform", isPeriodOpen && "rotate-180")} />
      </button>
      {isPeriodOpen && (
        <div className="flex flex-col gap-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <input
              type="time"
              value={windowStart}
              onChange={(event) => setWindowStart(event.target.value)}
              className={cn("rounded-md px-1.5 py-0.5 [color-scheme:dark]", tone.surface)}
            />
            <span className={tone.muted}>até</span>
            <input
              type="time"
              value={windowEnd}
              onChange={(event) => setWindowEnd(event.target.value)}
              className={cn("rounded-md px-1.5 py-0.5 [color-scheme:dark]", tone.surface)}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_LABELS.map((label, weekday) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleWeekday(weekday)}
                className={cn(
                  "rounded-full px-2 py-0.5 font-medium transition-colors",
                  weekdays.includes(weekday) ? tone.accent : tone.chipIdle,
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <span className={tone.muted}>Apenas com as tags</span>
            {tags.length === 0 ? (
              <span className={tone.muted}>Nenhuma tag neste tracking.</span>
            ) : (
              <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium transition-colors",
                      tagIds.includes(tag.id) ? tone.accent : tone.chipIdle,
                    )}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="flex items-center justify-between gap-2">
            <span>Não disparar em atendimento</span>
            <Switch checked={skipWhenInService} onCheckedChange={setSkipWhenInService} className={cn("scale-90", tone.switch)} />
          </label>
        </div>
      )}

      {saved?.lastError && <p className="text-[11px] text-destructive">Último erro: {saved.lastError}</p>}

      {isDirty && (
        <button
          type="button"
          disabled={saveTrigger.isPending}
          onClick={() => persist(isActive)}
          className={cn("flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-60", tone.accent)}
        >
          {saveTrigger.isPending && <OrbitaSpinner className="size-3.5 " />}
          Salvar
        </button>
      )}
    </article>
    </LightRunBorder>
  );
}
