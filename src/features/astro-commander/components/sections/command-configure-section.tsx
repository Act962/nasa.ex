"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw, Settings2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useUpdateAstroCommand } from "@/features/astro-commander/hooks/use-astro-commands";
import {
  AUTONOMY_LABELS,
  PERSONA_LABELS,
} from "@/features/astro-commander/lib/labels";
import { describeCron, isValidCron } from "@/features/astro-commander/lib/cron";
import { SettingRow } from "@/features/astro-commander/components/setting-row";
import type { CommandDetailData } from "@/features/astro-commander/components/types";

/** Configuração do comando (spec 0028, RF-20). */

const EVENTS = [
  { value: "lead.created", label: "Quando entrar um lead novo" },
  { value: "chat.message.received", label: "Quando chegar mensagem no chat" },
  { value: "bank.statement.imported", label: "Quando importar extrato" },
];

const TRIGGERS = [
  { value: "SCHEDULE", label: "Em horário marcado" },
  { value: "EVENT", label: "Quando algo acontecer" },
  { value: "ONCE", label: "Uma vez só" },
] as const;

const DEFAULTS = { maxRunsPerDay: 24, maxStarsPerRun: 200 };

export function CommandConfigureSection({ command }: { command: CommandDetailData }) {
  const update = useUpdateAstroCommand();
  const [form, setForm] = useState({
    title: command.title,
    persona: command.persona,
    timezone: command.timezone,
    triggerType: command.triggerType,
    cron: command.cron ?? "0 8 * * *",
    eventKey: command.eventKey ?? EVENTS[0]!.value,
    autonomy: command.autonomy,
    approvalThreshold: command.approvalThreshold ?? 0,
    maxRunsPerDay: command.maxRunsPerDay,
    maxStarsPerRun: command.maxStarsPerRun,
    vocabulary: command.vocabulary.join(", "),
    blockedWords: command.blockedWords.join(", "),
  });

  const cronIsValid = form.triggerType !== "SCHEDULE" || isValidCron(form.cron);

  function handleSave() {
    if (!cronIsValid) {
      toast.error("Agendamento inválido: use 5 campos, ex. 0 8 * * *");
      return;
    }
    update.mutate(
      {
        id: command.id,
        title: form.title,
        persona: form.persona,
        timezone: form.timezone,
        triggerType: form.triggerType,
        cron: form.triggerType === "SCHEDULE" ? form.cron : null,
        eventKey: form.triggerType === "EVENT" ? form.eventKey : null,
        autonomy: form.autonomy,
        approvalThreshold:
          form.autonomy === "APPROVE_ABOVE" ? Number(form.approvalThreshold) : null,
        maxRunsPerDay: Number(form.maxRunsPerDay),
        maxStarsPerRun: Number(form.maxStarsPerRun),
        vocabulary: splitList(form.vocabulary),
        blockedWords: splitList(form.blockedWords),
      },
      {
        onSuccess: () => toast.success("Comando salvo"),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Tabs defaultValue="geral" className="gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Configuração</h2>
        <div className="flex items-center gap-2">
          <TabsList className="h-auto rounded-2xl bg-muted/60 p-1.5">
            <TabsTrigger
              value="geral"
              className="gap-2 rounded-xl px-4 py-2 data-[state=active]:bg-background"
            >
              <Settings2 className="size-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger
              value="execucao"
              className="gap-2 rounded-xl px-4 py-2 data-[state=active]:bg-background"
            >
              <SlidersHorizontal className="size-4" />
              Execução
            </TabsTrigger>
          </TabsList>
          <Button onClick={handleSave} disabled={update.isPending} className="h-10 rounded-xl">
            {update.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>

      <TabsContent value="geral">
        <div className="rounded-2xl border bg-card px-6">
          <SettingRow
            label="Nome do comando"
            description="Como ele aparece na lista e nas notificações"
          >
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="h-11 rounded-xl"
            />
          </SettingRow>

          <SettingRow
            label="Papel"
            description="Define o tom, as regras e as ferramentas sugeridas"
          >
            <Select
              value={form.persona}
              onValueChange={(value) =>
                setForm({ ...form, persona: value as typeof form.persona })
              }
            >
              <SelectTrigger className="h-11 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERSONA_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            label="Fuso horário"
            description="Base para os horários do agendamento"
          >
            <Input
              value={form.timezone}
              onChange={(event) => setForm({ ...form, timezone: event.target.value })}
              className="h-11 rounded-xl"
            />
          </SettingRow>

          <SettingRow
            label="Termos da empresa"
            description="Separe por vírgula. Ajuda o ASTRO a escrever do jeito certo"
          >
            <Input
              value={form.vocabulary}
              onChange={(event) => setForm({ ...form, vocabulary: event.target.value })}
              placeholder="plano anual, onboarding, pós-venda"
              className="h-11 rounded-xl"
            />
          </SettingRow>

          <SettingRow
            label="Palavras proibidas"
            description="O ASTRO nunca usa estas palavras"
          >
            <Input
              value={form.blockedWords}
              onChange={(event) =>
                setForm({ ...form, blockedWords: event.target.value })
              }
              placeholder="garantido, barato"
              className="h-11 rounded-xl"
            />
          </SettingRow>
        </div>
      </TabsContent>

      <TabsContent value="execucao">
        <div className="rounded-2xl border bg-card px-6">
          <SettingRow
            label="Quando roda"
            description="O que dispara este comando"
          >
            <div className="flex rounded-xl bg-muted/60 p-1">
              {TRIGGERS.map((trigger) => (
                <button
                  key={trigger.value}
                  type="button"
                  onClick={() => setForm({ ...form, triggerType: trigger.value })}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-sm transition-colors",
                    form.triggerType === trigger.value
                      ? "bg-background font-medium shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {trigger.label}
                </button>
              ))}
            </div>
          </SettingRow>

          {form.triggerType === "SCHEDULE" && (
            <SettingRow
              label="Agendamento"
              description={
                cronIsValid
                  ? describeCron(form.cron)
                  : "Formato inválido. Use 5 campos, ex. 0 8 * * *"
              }
            >
              <Input
                value={form.cron}
                onChange={(event) => setForm({ ...form, cron: event.target.value })}
                placeholder="0 8 * * *"
                className={cn(
                  "h-11 rounded-xl",
                  !cronIsValid && "border-destructive",
                )}
              />
            </SettingRow>
          )}

          {form.triggerType === "EVENT" && (
            <SettingRow label="Evento" description="O que acontece na plataforma">
              <Select
                value={form.eventKey}
                onValueChange={(value) => setForm({ ...form, eventKey: value })}
              >
                <SelectTrigger className="h-11 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENTS.map((event) => (
                    <SelectItem key={event.value} value={event.value}>
                      {event.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
          )}

          <SettingRow
            label="Autonomia"
            description="Ações financeiras sempre pedem aprovação, mesmo no automático"
          >
            <Select
              value={form.autonomy}
              onValueChange={(value) =>
                setForm({ ...form, autonomy: value as typeof form.autonomy })
              }
            >
              <SelectTrigger className="h-11 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AUTONOMY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          {form.autonomy === "APPROVE_ABOVE" && (
            <SettingRow
              label="Limite de aprovação"
              description="Acima deste valor, a ação espera um humano"
            >
              <Input
                type="number"
                min={0}
                value={form.approvalThreshold}
                onChange={(event) =>
                  setForm({ ...form, approvalThreshold: Number(event.target.value) })
                }
                className="h-11 rounded-xl"
              />
            </SettingRow>
          )}

          <SettingRow
            label="Execuções por dia"
            description="Teto diário. Atingido, o comando para de rodar até o dia seguinte"
          >
            <RangeField
              value={form.maxRunsPerDay}
              min={1}
              max={500}
              suffix="/dia"
              onChange={(value) => setForm({ ...form, maxRunsPerDay: value })}
            />
          </SettingRow>

          <SettingRow
            label="Stars por execução"
            description="Teto de consumo de cada execução"
          >
            <RangeField
              value={form.maxStarsPerRun}
              min={1}
              max={5000}
              suffix="★"
              onChange={(value) => setForm({ ...form, maxStarsPerRun: value })}
            />
          </SettingRow>

          <SettingRow label="Restaurar padrões" description="Volta os tetos ao valor inicial">
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => setForm({ ...form, ...DEFAULTS })}
            >
              <RotateCcw className="size-4" />
              Restaurar
            </Button>
          </SettingRow>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function RangeField({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {value}
        {suffix}
      </span>
    </div>
  );
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
