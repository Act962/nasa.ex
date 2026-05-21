"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import {
  DURATION_PRESETS,
  DurationUnit,
  formatMinutesPtBr,
  fromMinutes,
  MAX_IDLE_MINUTES,
  toMinutes,
} from "../lib/duration";
import { IDLE_TEMPLATE_PLACEHOLDERS } from "../lib/idle-template";
import {
  useIdleAutomation,
  useUpdateIdleAutomation,
} from "../hooks/use-idle-automation";

const formSchema = z.object({
  active: z.boolean(),
  durationValue: z.number().int().min(1),
  durationUnit: z.enum(["minutes", "hours", "days"]),
  enableAi: z.boolean(),
  messageMode: z.enum(["NONE", "FIXED", "AI_REOPEN"]),
  message: z.string().optional(),
  notifyResp: z.boolean(),
  respTemplate: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export type IdleScenario = "noFirstResp" | "inConv";

interface Props {
  trackingId: string;
  scenario: IdleScenario;
  copy: {
    title: string;
    description: string;
    activeLabel: string;
    activeDescription: string;
  };
}

const DEFAULT_MINUTES: Record<IdleScenario, number> = {
  noFirstResp: 60,
  inConv: 120,
};

const fieldKey = (scenario: IdleScenario) =>
  ({
    active: `${scenario}Active` as const,
    minutes: `${scenario}Minutes` as const,
    enableAi: `${scenario}EnableAi` as const,
    messageMode: `${scenario}MessageMode` as const,
    message: `${scenario}Message` as const,
    notifyResp: `${scenario}NotifyResp` as const,
    respTemplate: `${scenario}RespTemplate` as const,
  }) as const;

export function InteractionsScenarioForm({ trackingId, scenario, copy }: Props) {
  const { config, isLoading } = useIdleAutomation(trackingId);
  const update = useUpdateIdleAutomation(trackingId);
  const keys = fieldKey(scenario);

  const minutesFromConfig =
    (config?.[keys.minutes] as number | undefined) ?? DEFAULT_MINUTES[scenario];
  const duration = fromMinutes(minutesFromConfig);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    values: {
      active: (config?.[keys.active] as boolean | undefined) ?? false,
      durationValue: duration.value,
      durationUnit: duration.unit,
      enableAi: (config?.[keys.enableAi] as boolean | undefined) ?? false,
      messageMode:
        (config?.[keys.messageMode] as FormData["messageMode"] | undefined) ??
        "NONE",
      message: (config?.[keys.message] as string | null | undefined) ?? "",
      notifyResp:
        (config?.[keys.notifyResp] as boolean | undefined) ?? false,
      respTemplate:
        (config?.[keys.respTemplate] as string | null | undefined) ?? "",
    },
  });

  const isSubmitting = update.isPending;
  const messageMode = form.watch("messageMode");
  const notifyResp = form.watch("notifyResp");
  const durationValue = form.watch("durationValue");
  const durationUnit = form.watch("durationUnit");
  const resolvedMinutes = (() => {
    try {
      return toMinutes({ value: Number(durationValue), unit: durationUnit });
    } catch {
      return 0;
    }
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner />
      </div>
    );
  }

  const onSubmit = (data: FormData) => {
    const minutes = toMinutes({
      value: data.durationValue,
      unit: data.durationUnit,
    });
    if (minutes < 1 || minutes > MAX_IDLE_MINUTES) {
      form.setError("durationValue", {
        message: `Valor deve estar entre 1 minuto e ${MAX_IDLE_MINUTES} minutos`,
      });
      return;
    }

    update.mutate({
      trackingId,
      scenario,
      patch: {
        active: data.active,
        minutes,
        enableAi: data.enableAi,
        messageMode: data.messageMode,
        message: data.messageMode === "FIXED" ? data.message ?? "" : null,
        notifyResp: data.notifyResp,
        respTemplate: data.notifyResp ? data.respTemplate ?? "" : null,
      },
    });
  };

  const applyPreset = (minutes: number) => {
    const d = fromMinutes(minutes);
    form.setValue("durationValue", d.value, { shouldDirty: true });
    form.setValue("durationUnit", d.unit, { shouldDirty: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{copy.title}</h3>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>{copy.activeLabel}</FieldLabel>
              <FieldDescription>{copy.activeDescription}</FieldDescription>
            </FieldContent>
            <Controller
              name="active"
              control={form.control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
          </Field>

          <FieldSeparator />

          <Field>
            <FieldLabel>Tempo de ociosidade</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-28"
                disabled={isSubmitting}
                {...form.register("durationValue", { valueAsNumber: true })}
              />
              <Controller
                name="durationUnit"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as DurationUnit)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutos</SelectItem>
                      <SelectItem value="hours">Horas</SelectItem>
                      <SelectItem value="days">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <span className="text-sm text-muted-foreground">
                = {formatMinutesPtBr(resolvedMinutes || 0)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {DURATION_PRESETS.map((p) => (
                <Badge
                  key={p.label}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => applyPreset(p.minutes)}
                >
                  {p.label}
                </Badge>
              ))}
            </div>
            {form.formState.errors.durationValue && (
              <p className="text-sm text-destructive">
                {form.formState.errors.durationValue.message}
              </p>
            )}
          </Field>

          <FieldSeparator />

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>Ligar a IA</FieldLabel>
              <FieldDescription>
                Reativa a IA para este lead (caso pausada) e dispara o agente
                para reabrir a conversa.
              </FieldDescription>
            </FieldContent>
            <Controller
              name="enableAi"
              control={form.control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
          </Field>

          <FieldSeparator />

          <Field>
            <FieldLabel>Enviar mensagem</FieldLabel>
            <Controller
              name="messageMode"
              control={form.control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="NONE" id={`mode-none-${scenario}`} />
                    <Label htmlFor={`mode-none-${scenario}`}>Nenhuma</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="FIXED"
                      id={`mode-fixed-${scenario}`}
                    />
                    <Label htmlFor={`mode-fixed-${scenario}`}>
                      Mensagem fixa (texto personalizado)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="AI_REOPEN"
                      id={`mode-ai-${scenario}`}
                    />
                    <Label htmlFor={`mode-ai-${scenario}`}>
                      IA reabre a conversa
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
            {messageMode === "FIXED" && (
              <Textarea
                className="mt-2"
                placeholder="Ex: Oi {lead.name}, ainda está aí?"
                disabled={isSubmitting}
                {...form.register("message")}
              />
            )}
          </Field>

          <FieldSeparator />

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>Notificar responsável</FieldLabel>
              <FieldDescription>
                Envia notificação in-app e mensagem no WhatsApp do responsável
                pelo lead.
              </FieldDescription>
            </FieldContent>
            <Controller
              name="notifyResp"
              control={form.control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
          </Field>

          {notifyResp && (
            <Field>
              <FieldLabel>Mensagem para o responsável</FieldLabel>
              <Textarea
                placeholder="Ex: Lead {lead.name} ({lead.phone}) está aguardando há {minutesWaiting} minutos."
                disabled={isSubmitting}
                {...form.register("respTemplate")}
              />
              <div className="flex flex-wrap gap-2 pt-2">
                {IDLE_TEMPLATE_PLACEHOLDERS.map((p) => (
                  <Badge key={p.token} variant="secondary">
                    {p.token}
                  </Badge>
                ))}
              </div>
              <FieldDescription>
                Placeholders disponíveis acima — clique pra ver o significado.
              </FieldDescription>
            </Field>
          )}
        </FieldGroup>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
