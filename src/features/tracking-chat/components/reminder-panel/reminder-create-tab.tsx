import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { ReminderRecurrenceType } from "@/generated/prisma/enums";
import { Spinner } from "@/components/ui/spinner";
import { RECURRENCE_LABELS } from "./data";
import { useCreateReminder } from "../../hooks/use-remimber";
import { phoneMaskFull, normalizePhone } from "@/utils/format-phone";
import { VariablePicker } from "@/features/executions/components/send-message/variable-picker";
import { useVariableAutocomplete } from "@/features/executions/components/send-message/use-variable-autocomplete";

const VariableTextarea = ({ value, onChange, ...props }: any) => {
  const {
    open,
    setOpen,
    search,
    setSearch,
    inputRef,
    handleKeyDown,
    handleSelect,
    handleValueChange,
  } = useVariableAutocomplete(value || "", onChange);

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={inputRef as any}
        value={value || ""}
        onChange={handleValueChange}
        onKeyDown={handleKeyDown}
      />
      <div className="absolute top-0 left-0">
        <VariablePicker
          open={open}
          onOpenChange={setOpen}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelect}
          triggerRef={inputRef}
        />
      </div>
    </div>
  );
};

const formSchema = z
  .object({
    message: z.string().min(1, "Mensagem obrigatória"),
    recurrenceType: z.nativeEnum(ReminderRecurrenceType),
    dayOfMonth: z.number().min(1).max(28).optional(),
    remindTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
    firstRemindAt: z.string().optional(),
    notifyPhone: z.string().optional(),
  })
  .refine(
    (data) => {
      if (
        data.recurrenceType === ReminderRecurrenceType.MONTHLY &&
        data.dayOfMonth
      ) {
        return true;
      }
      return !!data.firstRemindAt;
    },
    { message: "Selecione a data de início", path: ["firstRemindAt"] },
  );

type FormValues = z.infer<typeof formSchema>;

interface ReminderCreateTabProps {
  onClose: () => void;
  conversationId?: string;
  leadId?: string;
  trackingId?: string;
  actionId?: string;
  phone: string | null;
  phoneOptional?: boolean;
}

export function ReminderCreateTab({
  onClose,
  conversationId,
  leadId,
  trackingId,
  actionId,
  phone,
  phoneOptional = false,
}: ReminderCreateTabProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
      recurrenceType: ReminderRecurrenceType.ONCE,
      remindTime: "09:00",
      firstRemindAt: new Date().toISOString().split("T")[0],
      notifyPhone: phoneMaskFull(phone ?? ""),
    },
  });

  const recurrenceType = form.watch("recurrenceType");
  const dayOfMonth = form.watch("dayOfMonth");

  const isMonthly = recurrenceType === ReminderRecurrenceType.MONTHLY;
  const needsFirstRemindAt = !isMonthly;

  const createReminder = useCreateReminder({
    conversationId,
    leadId,
    trackingId,
    actionId,
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!phoneOptional && !values.notifyPhone?.trim()) {
      form.setError("notifyPhone", {
        type: "manual",
        message: "Número obrigatório",
      });
      return;
    }
    createReminder.mutate(
      {
        message: values.message,
        recurrenceType: values.recurrenceType,
        dayOfMonth:
          isMonthly && values.dayOfMonth ? values.dayOfMonth : undefined,
        remindTime: values.remindTime,
        firstRemindAt:
          needsFirstRemindAt && values.firstRemindAt
            ? new Date(
                `${values.firstRemindAt}T${values.remindTime}:00`,
              ).toISOString()
            : undefined,
        notifyPhone: values.notifyPhone
          ? normalizePhone(values.notifyPhone)
          : undefined,
        conversationId,
        leadId,
        trackingId,
        actionId,
      },
      { onSuccess: onClose },
    );
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 px-5 py-4 overflow-y-auto"
    >
      {/* Mensagem */}
      <Controller
        control={form.control}
        name="message"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5">
            <Label>Mensagem do lembrete</Label>
            <VariableTextarea
              {...field}
              placeholder="Ex: Cobrar pagamento da proposta #123"
              className="resize-none"
              rows={3}
            />
            {fieldState.error && (
              <p className="text-xs text-destructive">
                {fieldState.error.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Clique em &quot;/&quot; para adicionar variáveis.
            </p>
          </div>
        )}
      />

      {/* Recorrência */}
      <div className="flex flex-col gap-1.5">
        <Label>Recorrência</Label>
        <Select
          value={recurrenceType}
          onValueChange={(v) => {
            form.setValue("recurrenceType", v as ReminderRecurrenceType);
            form.setValue("dayOfMonth", undefined); // limpa ao trocar
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dia fixo do mês — só aparece em MONTHLY */}
      {isMonthly && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dayOfMonth">
            Dia fixo do mês{" "}
            <span className="text-muted-foreground text-xs">
              (1–28, opcional)
            </span>
          </Label>
          <Input
            id="dayOfMonth"
            type="number"
            min={1}
            max={28}
            placeholder="Ex: 15"
            {...form.register("dayOfMonth", { valueAsNumber: true })}
          />
        </div>
      )}

      {/* Data de início — oculta quando mensal + dia fixo definido */}
      {needsFirstRemindAt && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="firstRemindAt">Data de início</Label>
          <Input
            id="firstRemindAt"
            type="date"
            {...form.register("firstRemindAt")}
          />
          {form.formState.errors.firstRemindAt && (
            <p className="text-xs text-destructive">
              {form.formState.errors.firstRemindAt.message}
            </p>
          )}
        </div>
      )}

      {/* Horário */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="remindTime">Horário</Label>
        <Input id="remindTime" type="time" {...form.register("remindTime")} />
      </div>

      {/* Telefone para notificação */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notifyPhone">
          WhatsApp para notificar{" "}
          <span className="text-muted-foreground text-xs">
            {phoneOptional ? "(opcional — vazio = só notificação no app)" : "(DDI + número)"}
          </span>
        </Label>
        <Input
          id="notifyPhone"
          type="tel"
          placeholder="+55 (11) 99988-7766"
          {...form.register("notifyPhone")}
          onChange={(e) => {
            form.setValue("notifyPhone", phoneMaskFull(e.target.value));
          }}
        />
        {form.formState.errors.notifyPhone && (
          <p className="text-xs text-destructive">
            {form.formState.errors.notifyPhone.message}
          </p>
        )}
      </div>

      {/* Preview automático para mensal + dia fixo */}
      {isMonthly && Number.isFinite(dayOfMonth) && dayOfMonth! >= 1 && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
          ℹ️ Primeiro disparo: próximo dia <strong>{dayOfMonth}</strong> às{" "}
          <strong>{form.watch("remindTime")}</strong>. Repete todo mês nesse
          dia.
        </p>
      )}

      <DialogFooter className="gap-2 pt-1 pb-2 sm:gap-0 mt-auto">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={createReminder.isPending}>
          {createReminder.isPending && <Spinner className="size-3 mr-1" />}
          Salvar lembrete
        </Button>
      </DialogFooter>
    </form>
  );
}
