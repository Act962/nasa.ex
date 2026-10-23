"use client";

// Um aviso da régua: quando sai (prazos prontos ou personalizado), por qual canal e o texto,
// com modelos em tom respeitoso, variáveis clicáveis, prévia e alerta de tom de ameaça.

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, Mail, MessageSquare, ShieldAlert, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useDeleteDunningStep, useUpdateDunningStep } from "../../hooks/use-payment-dunning";
import {
  DUNNING_MESSAGE_TEMPLATES,
  DUNNING_VARIABLES,
  MAX_DAYS_AFTER,
  MAX_DAYS_BEFORE,
  TIMING_PRESETS,
  describeTiming,
  findRiskyTerms,
  phaseOf,
  renderDunningPreview,
} from "../../lib/dunning-presets";
import { ConfirmDeleteDialog } from "../shared/confirm-delete-dialog";

type DunningChannel = "EMAIL" | "WHATSAPP" | "SMS";

export type DunningStepData = {
  id: string;
  daysOffset: number;
  channel: DunningChannel;
  templateSubject: string | null;
  templateBody: string;
  enabled: boolean;
};

const CUSTOM_TIMING = "custom";

export function DunningStepEditor({
  step,
  hasSameDayStep,
}: {
  step: DunningStepData;
  /** Outro aviso da régua cai no mesmo dia: só um sai (máximo de um aviso por dia ao cliente). */
  hasSameDayStep: boolean;
}) {
  const updateStep = useUpdateDunningStep();
  const deleteStep = useDeleteDunningStep();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [isCustomTiming, setIsCustomTiming] = useState(!TIMING_PRESETS.includes(step.daysOffset));
  const [customDays, setCustomDays] = useState(Math.max(Math.abs(step.daysOffset), 1));
  const [customDirection, setCustomDirection] = useState<"before" | "after">(step.daysOffset < 0 ? "before" : "after");
  const [subject, setSubject] = useState(step.templateSubject ?? "");
  const [body, setBody] = useState(step.templateBody);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const phase = phaseOf(step.daysOffset);
  const riskyTerms = findRiskyTerms(`${subject} ${body}`);
  const ChannelIcon = step.channel === "EMAIL" ? Mail : MessageSquare;

  function persist(patch: Partial<Omit<DunningStepData, "id">>) {
    updateStep.mutate(
      { id: step.id, ...patch },
      { onError: (error) => toast.error(error.message ?? "Não foi possível salvar o aviso") },
    );
  }

  function handleTimingChange(value: string) {
    if (value === CUSTOM_TIMING) {
      setIsCustomTiming(true);
      return;
    }
    setIsCustomTiming(false);
    persist({ daysOffset: Number(value) });
  }

  function persistCustomTiming(days: number, direction: "before" | "after") {
    const limit = direction === "before" ? MAX_DAYS_BEFORE : MAX_DAYS_AFTER;
    const clampedDays = Math.min(Math.max(Math.round(days) || 1, 1), limit);
    setCustomDays(clampedDays);
    const nextOffset = direction === "before" ? -clampedDays : clampedDays;
    if (nextOffset !== step.daysOffset) persist({ daysOffset: nextOffset });
  }

  function applyTemplate(templateBody: string, templateSubject: string) {
    setBody(templateBody);
    setSubject(templateSubject);
    persist({ templateBody, ...(step.channel === "EMAIL" ? { templateSubject } : {}) });
    toast.success("Modelo aplicado");
  }

  function insertVariable(token: string) {
    const textarea = bodyRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    const nextBody = `${body.slice(0, start)}${token}${body.slice(end)}`;
    setBody(nextBody);
    persist({ templateBody: nextBody });
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <Card className="gap-3 bg-background p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            step.channel === "EMAIL" ? "bg-info/15 text-info" : "bg-success/15 text-success",
          )}
        >
          <ChannelIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{describeTiming(step.daysOffset)}</p>
          <p className="text-[11px] text-muted-foreground">
            {phase === "before" ? "Lembrete" : phase === "due" ? "Aviso de vencimento" : "Aviso de atraso"} por{" "}
            {step.channel === "EMAIL" ? "e-mail" : "WhatsApp"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="Excluir aviso"
          onClick={() => setIsConfirmingDelete(true)}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Quando enviar</Label>
          <Select
            value={isCustomTiming ? CUSTOM_TIMING : String(step.daysOffset)}
            onValueChange={handleTimingChange}
          >
            <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMING_PRESETS.map((offset) => (
                <SelectItem key={offset} value={String(offset)} className="text-sm">
                  {describeTiming(offset)}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_TIMING} className="text-sm">Personalizado…</SelectItem>
            </SelectContent>
          </Select>
          {isCustomTiming && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={customDirection === "before" ? MAX_DAYS_BEFORE : MAX_DAYS_AFTER}
                value={customDays}
                onChange={(event) => setCustomDays(Number(event.target.value))}
                onBlur={() => persistCustomTiming(customDays, customDirection)}
                className="h-9 w-20 text-sm"
                aria-label="Quantidade de dias"
              />
              <span className="text-xs text-muted-foreground">dias</span>
              <Select
                value={customDirection}
                onValueChange={(value) => {
                  const direction = value as "before" | "after";
                  setCustomDirection(direction);
                  persistCustomTiming(customDays, direction);
                }}
              >
                <SelectTrigger className="h-9 flex-1 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="before" className="text-sm">antes do vencimento</SelectItem>
                  <SelectItem value="after" className="text-sm">depois do vencimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Canal</Label>
          <Select value={step.channel} onValueChange={(value) => persist({ channel: value as DunningChannel })}>
            <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="WHATSAPP" className="text-sm">WhatsApp</SelectItem>
              <SelectItem value="EMAIL" className="text-sm">E-mail</SelectItem>
              <SelectItem value="SMS" className="text-sm" disabled>SMS (em breve)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasSameDayStep && (
        <p className="text-[11px] text-warning">
          Outro aviso desta régua cai no mesmo dia. O cliente recebe no máximo um aviso por dia, então só um vai sair.
        </p>
      )}

      {step.channel === "EMAIL" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Assunto do e-mail</Label>
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            onBlur={() => subject !== (step.templateSubject ?? "") && persist({ templateSubject: subject || null })}
            placeholder="Lembrete: {{descricao}} vence em {{vencimento}}"
            className="h-9 text-sm"
            maxLength={200}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Mensagem</Label>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  <Wand2 className="size-3.5" />
                  Usar modelo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {DUNNING_MESSAGE_TEMPLATES[phase].map((template) => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => applyTemplate(template.body, template.subject)}
                  >
                    {template.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setIsPreviewOpen((isOpen) => !isOpen)}
            >
              <Eye className="size-3.5" />
              {isPreviewOpen ? "Ocultar prévia" : "Prévia"}
            </Button>
          </div>
        </div>
        <Textarea
          ref={bodyRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onBlur={() => body !== step.templateBody && persist({ templateBody: body })}
          rows={4}
          className="text-sm"
          maxLength={2000}
        />
        <div className="flex flex-wrap gap-1">
          {DUNNING_VARIABLES.map((variable) => (
            <button
              key={variable.token}
              type="button"
              onClick={() => insertVariable(variable.token)}
              title={`Inserir ${variable.token}`}
              className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              + {variable.label}
            </button>
          ))}
        </div>
        {isPreviewOpen && (
          <div className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 p-3 text-xs">
            {step.channel === "EMAIL" && subject && (
              <p className="mb-2 font-medium">{renderDunningPreview(subject)}</p>
            )}
            {renderDunningPreview(body)}
          </div>
        )}
        {riskyTerms.length > 0 && (
          <p className="flex items-start gap-1.5 text-[11px] text-warning">
            <ShieldAlert className="mt-px size-3.5 shrink-0" />
            <span>
              &quot;{riskyTerms.join("\", \"")}&quot; {riskyTerms.length > 1 ? "podem" : "pode"} soar como ameaça ou constrangimento, o que o Código de
              Defesa do Consumidor proíbe na cobrança (art. 42). Prefira um tom informativo.
            </span>
          </p>
        )}
      </div>

      <ConfirmDeleteDialog
        isOpen={isConfirmingDelete}
        title="Excluir aviso"
        description={`Excluir o aviso "${describeTiming(step.daysOffset).toLowerCase()}"? As cobranças que já usam esta régua deixam de receber esse aviso.`}
        isPending={deleteStep.isPending}
        onConfirm={() =>
          deleteStep.mutate(
            { id: step.id },
            {
              onSuccess: () => {
                setIsConfirmingDelete(false);
                toast.success("Aviso excluído");
              },
              onError: (error) => toast.error(error.message ?? "Erro ao excluir aviso"),
            },
          )
        }
        onClose={() => setIsConfirmingDelete(false)}
      />
    </Card>
  );
}
