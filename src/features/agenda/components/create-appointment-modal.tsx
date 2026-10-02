"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import { Calendar } from "@/features/agenda/components/external-link/calendar";
import {
  getLocalTimeZone,
  today,
  CalendarDate,
  parseDate,
  DateValue,
} from "@internationalized/date";
import dayjs from "dayjs";
import { useQueryPublicAgendaTimeSlots } from "@/features/agenda/hooks/use-public-agenda";
import {
  useQueryAgendasByTracking,
  useAdminCreateAppointment,
} from "@/features/agenda/hooks/use-agenda";
import { DayOfWeek } from "@/generated/prisma/enums";
import { countries } from "@/types/some";
import { normalizePhone, phoneMask } from "@/utils/format-phone";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  CalendarIcon,
  ClockIcon,
  CheckIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
  StickyNoteIcon,
  TypeIcon,
} from "lucide-react";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

interface Props {
  open: boolean;
  onClose: () => void;
  trackingId?: string;
  initialDate?: Date;
  initialName?: string;
  initialPhone?: string;
  initialEmail?: string;
  onSuccess?: (appointmentId: string) => void;
}

const formSchema = z.object({
  title: z.string().optional(),
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().optional(),
  phone: z.string().min(1, "Telefone é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const dayMap: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

/** Sem disponibilidade configurada: horários de 30 em 30 min para escolher com um toque. */
function buildHalfHourTimes(fromHour: number, toHour: number): string[] {
  const times: string[] = [];
  for (let hour = fromHour; hour < toHour; hour++) {
    times.push(`${String(hour).padStart(2, "0")}:00`, `${String(hour).padStart(2, "0")}:30`);
  }
  return times;
}

const MANUAL_TIME_PERIODS = [
  { label: "Manhã", times: buildHalfHourTimes(7, 12) },
  { label: "Tarde", times: buildHalfHourTimes(12, 18) },
  { label: "Noite", times: buildHalfHourTimes(18, 22) },
];

export function CreateAppointmentModal({
  open,
  onClose,
  trackingId,
  initialDate,
  initialName,
  initialPhone,
  initialEmail,
  onSuccess,
}: Props) {
  // Load agendas (all org agendas when trackingId is absent)
  const { data: agendasData, isLoading: isLoadingAgendas } =
    useQueryAgendasByTracking(trackingId || undefined);
  const agendas = agendasData?.agendas ?? [];

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedAgendaId, setSelectedAgendaId] = useState("");
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(() =>
    initialDate
      ? parseDate(dayjs(initialDate).format("YYYY-MM-DD"))
      : today(getLocalTimeZone()),
  );
  const [selectedTime, setSelectedTime] = useState("");
  const [manualTime, setManualTime] = useState(""); // fallback when no slots
  const [isCustomTimeOpen, setIsCustomTimeOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const initialPhoneMasked = (() => {
    if (!initialPhone) return "";
    const raw = initialPhone.replace(/\D/g, "").replace(/^55/, "");
    return phoneMask(raw);
  })();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      name: initialName ?? "",
      phone: initialPhoneMasked,
      code: "55",
      email: initialEmail ?? "",
      notes: "",
    },
  });

  const selectedCode = form.watch("code");
  const countrySelected =
    countries.find((c) => c.code === selectedCode) ?? countries[0];

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedTime("");
      setManualTime("");
      setShowMoreOptions(false);
      // Extract just the numeric digits from the phone for the masked input
      const rawPhone = initialPhone
        ? initialPhone.replace(/\D/g, "").replace(/^55/, "")
        : "";
      const maskedPhone = rawPhone ? phoneMask(rawPhone) : "";
      form.reset({
        title: "",
        name: initialName ?? "",
        phone: maskedPhone,
        code: "55",
        email: initialEmail ?? "",
        notes: "",
      });
      if (initialDate)
        setSelectedDate(parseDate(dayjs(initialDate).format("YYYY-MM-DD")));
    }
  }, [open, initialDate, initialName, initialPhone, initialEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select when only 1 agenda available
  useEffect(() => {
    if (agendas.length === 1) setSelectedAgendaId(agendas[0].id);
  }, [agendas]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedAgenda = agendas.find((a) => a.id === selectedAgendaId);
  const dateStr = selectedDate.toString();

  // Availability logic (for greying out dates)
  const availabilityMap: Partial<Record<DayOfWeek, boolean>> =
    Object.fromEntries(
      (selectedAgenda?.availabilities ?? []).map((a: any) => [
        a.dayOfWeek,
        a.isActive,
      ]),
    );
  const blockedDatesSet = new Set(
    (selectedAgenda?.dateOverrides ?? [])
      .filter((d: any) => d.isBlocked)
      .map((d: any) => d.date),
  );
  const isDateUnavailable = (date: DateValue): boolean => {
    if (!selectedAgenda) return false;
    if (blockedDatesSet.has(date.toString())) return true;
    const jsDay = date.toDate(getLocalTimeZone()).getDay();
    const isActive = availabilityMap[dayMap[jsDay]];
    return isActive === undefined ? true : !isActive;
  };

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Time slots from agenda
  const { timeSlots, isLoading: isLoadingSlots } =
    useQueryPublicAgendaTimeSlots(
      selectedAgenda
        ? {
            orgSlug: selectedAgenda.organization.slug,
            agendaSlug: selectedAgenda.slug,
            date: dateStr,
            includeUnavailable: true,
            timeZone,
          }
        : {
            orgSlug: "",
            agendaSlug: "",
            date: dateStr,
            includeUnavailable: true,
            timeZone,
          },
    );

  const visibleSlots = (timeSlots ?? []).filter((s) => !s.isPast);

  // Effective time: selected slot OR manual input
  const effectiveTime = selectedTime || manualTime;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const createAdminAppointment = useAdminCreateAppointment();

  const onSubmit = (data: FormData) => {
    if (!selectedAgendaId) {
      form.setError("name", { message: "" });
      return;
    }
    if (!effectiveTime) return;
    const phone = normalizePhone(countrySelected.ddi + data.phone);
    createAdminAppointment.mutate(
      {
        agendaId: selectedAgendaId,
        date: dateStr,
        time: effectiveTime,
        title: data.title?.trim() || undefined,
        name: data.name,
        phone,
        email: data.email,
        notes: data.notes,
        timeZone,
      },
      {
        onSuccess: (data) => {
          onClose();
          onSuccess?.(data.appointment.id);
        },
      },
    );
  };

  const isSubmitting = createAdminAppointment.isPending;
  const canSubmit = !!selectedAgendaId && !!effectiveTime;

  const selectedDateLabel = dayjs(
    selectedDate.toDate(getLocalTimeZone()),
  ).format("DD/MM/YYYY");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn(
          "flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-[24px] p-0 sm:max-w-2xl",
          "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0",
          "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom",
        )}
      >
        <div
          aria-hidden
          className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted sm:hidden"
        />
        <DialogHeader className="shrink-0 border-b border-line px-4 pt-3 pb-3 text-left sm:px-6 sm:pt-5 sm:pb-4">
          <DialogTitle className="flex items-center gap-2 pr-10 text-base font-semibold">
            <CalendarIcon className="size-4 text-info" />
            Novo compromisso
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:space-y-6 sm:px-6 sm:py-5">
            {/* ── Seção 1: Agenda + Data + Horário ─────────────────────────── */}
            <div className="space-y-3 sm:space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quando
              </p>

              {isLoadingAgendas ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" /> Carregando agendas…
                </div>
              ) : agendas.length === 0 ? (
                <div className="flex items-center gap-2 rounded-[18px] border border-dashed border-line p-3 text-sm text-muted-foreground">
                  <CalendarIcon className="size-4 shrink-0" />
                  Nenhuma agenda disponível. Crie uma agenda antes de agendar.
                </div>
              ) : agendas.length > 1 ? (
                <Field className="gap-y-1.5">
                  <FieldLabel>
                    Agenda <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Select
                    value={selectedAgendaId}
                    onValueChange={(agendaId) => {
                      setSelectedAgendaId(agendaId);
                      setSelectedTime("");
                    }}
                  >
                    <SelectTrigger className="h-11 w-full sm:h-9">
                      <SelectValue placeholder="Selecione uma agenda…" />
                    </SelectTrigger>
                    <SelectContent>
                      {agendas.map((agenda) => (
                        <SelectItem key={agenda.id} value={agenda.id}>
                          {agenda.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <div className="flex min-w-0 items-center gap-2 rounded-[18px] border border-line bg-muted px-3 py-2.5 text-sm">
                  <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">
                    {agendas[0]?.name}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    agenda selecionada
                  </span>
                </div>
              )}

              <div className="overflow-hidden rounded-[18px] border border-line bg-card">
                <div className="flex flex-col sm:flex-row">
                  <div className="flex flex-col border-b border-line p-3 sm:border-r sm:border-b-0 sm:p-4">
                    <p className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground sm:mb-3">
                      <CalendarIcon className="size-3.5" /> Data
                    </p>
                    <div className="flex w-full justify-center overflow-x-auto sm:justify-start">
                      <Calendar
                        minValue={today(getLocalTimeZone())}
                        isDateUnavailable={isDateUnavailable}
                        value={selectedDate}
                        onChange={(date) => {
                          setSelectedDate(date as CalendarDate);
                          setSelectedTime("");
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
                    <p className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground sm:mb-3">
                      <ClockIcon className="size-3.5" />
                      {selectedDateLabel}
                    </p>

                    {!selectedAgendaId ? (
                      <div className="flex flex-1 flex-col items-center justify-center py-6 text-center sm:py-8">
                        <CalendarIcon className="mb-2 size-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                          {agendas.length > 1
                            ? "Selecione uma agenda para ver os horários"
                            : "Selecione uma data"}
                        </p>
                      </div>
                    ) : isLoadingSlots ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <Spinner className="size-4" /> Carregando horários…
                      </div>
                    ) : visibleSlots.length > 0 ? (
                      <div className="flex flex-wrap content-start gap-2 sm:max-h-64 sm:overflow-y-auto sm:pr-1">
                        {visibleSlots.map((slot) => {
                          const isDisabled =
                            slot.isOccupied || slot.isBlocked || slot.isPast;
                          const statusLabel = slot.isBlocked
                            ? "Bloqueado"
                            : slot.isOccupied
                              ? "Ocupado"
                              : slot.isPast
                                ? "Passado"
                                : null;
                          const isSelected =
                            !isDisabled && selectedTime === slot.startTime;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              disabled={isDisabled}
                              aria-disabled={isDisabled}
                              aria-pressed={isSelected}
                              title={statusLabel ?? undefined}
                              onClick={() => {
                                if (isDisabled) return;
                                setSelectedTime(slot.startTime);
                                setManualTime("");
                              }}
                              className={cn(
                                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium tabular-nums transition-colors",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                  : isDisabled
                                    ? "cursor-not-allowed border-dashed border-line bg-muted text-muted-foreground opacity-60"
                                    : "border-line bg-card text-foreground hover:border-primary hover:bg-primary/5",
                              )}
                            >
                              {isSelected && (
                                <CheckIcon className="size-3.5 shrink-0" />
                              )}
                              <span className={cn(isDisabled && "line-through")}>
                                {slot.startTime}
                              </span>
                              {statusLabel && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide">
                                  {statusLabel}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Sem horários configurados para esta data — toque em um:
                        </p>
                        {MANUAL_TIME_PERIODS.map((period) => (
                          <div key={period.label} className="space-y-1.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {period.label}
                            </p>
                            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                              {period.times.map((time) => {
                                const isChosen = manualTime === time;
                                return (
                                  <button
                                    key={time}
                                    type="button"
                                    onClick={() => {
                                      setManualTime(time);
                                      setSelectedTime("");
                                    }}
                                    className={cn(
                                      "h-9 rounded-full border text-sm font-medium tabular-nums transition-colors",
                                      isChosen
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-line bg-card hover:border-primary hover:bg-primary/5",
                                    )}
                                  >
                                    {time}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setIsCustomTimeOpen((isOpen) => !isOpen)}
                          className="text-xs font-medium text-info"
                        >
                          {isCustomTimeOpen ? "Fechar" : "Outro horário (ex.: 10:15)"}
                        </button>
                        {isCustomTimeOpen && (
                          <Input
                            type="time"
                            value={manualTime}
                            onChange={(event) => {
                              setManualTime(event.target.value);
                              setSelectedTime("");
                            }}
                            className="h-11 w-full sm:h-9 sm:w-36"
                          />
                        )}
                      </div>
                    )}

                    {effectiveTime && (
                      <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-xs font-medium text-primary">
                        <CheckIcon className="size-3.5" />
                        Horário selecionado: <strong>{effectiveTime}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Seção 2: Dados do cliente ─────────────────────────────────── */}
            <div className="space-y-3 sm:space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dados do cliente
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <Field className="gap-y-1.5">
                  <FieldLabel
                    htmlFor="name"
                    className="flex items-center gap-1.5"
                  >
                    <UserIcon className="size-3.5 text-muted-foreground" />
                    Nome <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="name"
                    placeholder="Nome completo"
                    autoComplete="name"
                    className="h-11 sm:h-9"
                    disabled={isSubmitting}
                    {...form.register("name")}
                  />
                  {form.formState.errors.name?.message && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </Field>

                <Field className="gap-y-1.5">
                  <FieldLabel
                    htmlFor="email"
                    className="flex items-center gap-1.5"
                  >
                    <MailIcon className="size-3.5 text-muted-foreground" />
                    Email
                  </FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="cliente@email.com"
                    className="h-11 sm:h-9"
                    disabled={isSubmitting}
                    {...form.register("email")}
                  />
                  {form.formState.errors.email?.message && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </Field>
              </div>

              <Field className="gap-y-1.5">
                <FieldLabel
                  htmlFor="phone"
                  className="flex items-center gap-1.5"
                >
                  <PhoneIcon className="size-3.5 text-muted-foreground" />
                  Telefone <span className="text-destructive">*</span>
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <InputGroup className="h-11 px-2 sm:h-9">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            disabled={isSubmitting}
                            type="button"
                            aria-label="Selecionar país"
                            className={cn(
                              "flex h-8 shrink-0 items-center gap-x-1 rounded-full px-2 text-xs transition-colors hover:bg-accent sm:h-7",
                              countrySelected && "bg-accent",
                            )}
                          >
                            <img
                              src={countrySelected.flag}
                              alt={countrySelected.country}
                              className="size-4 rounded-sm"
                            />
                            <span>{countrySelected.ddi}</span>
                            <ChevronDownIcon className="size-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="max-h-40 overflow-y-auto"
                        >
                          <DropdownMenuGroup>
                            {countries.map((country) => (
                              <DropdownMenuItem
                                key={country.code}
                                onClick={() =>
                                  form.setValue("code", country.code)
                                }
                                className="cursor-pointer"
                              >
                                <img
                                  src={country.flag}
                                  alt={country.country}
                                  className="size-5 rounded-sm"
                                />
                                <span>{country.ddi}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <InputGroupInput
                        placeholder="(00) 0000-0000"
                        inputMode="tel"
                        autoComplete="tel-national"
                        className="pl-2"
                        disabled={isSubmitting}
                        {...field}
                        onChange={(event) =>
                          field.onChange(phoneMask(event.target.value))
                        }
                      />
                    </InputGroup>
                  )}
                />
                <FieldDescription>
                  {form.formState.errors.phone?.message ??
                    "Formato (00) 0000-0000, sem o 9"}
                </FieldDescription>
              </Field>

              {/* Opcionais: recolhidos no mobile para reduzir a rolagem */}
              <button
                type="button"
                onClick={() => setShowMoreOptions((isShown) => !isShown)}
                aria-expanded={showMoreOptions}
                className="flex h-10 w-full items-center justify-between rounded-[18px] border border-line bg-muted px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:hidden"
              >
                Mais opções
                <ChevronDownIcon
                  className={cn(
                    "size-4 transition-transform",
                    showMoreOptions && "rotate-180",
                  )}
                />
              </button>

              <div
                className={cn(
                  "space-y-3 sm:space-y-4",
                  !showMoreOptions && "max-sm:hidden",
                )}
              >
                <Field className="gap-y-1.5">
                  <FieldLabel
                    htmlFor="title"
                    className="flex items-center gap-1.5"
                  >
                    <TypeIcon className="size-3.5 text-muted-foreground" />
                    Título do compromisso
                  </FieldLabel>
                  <Input
                    id="title"
                    placeholder="Ex.: Reunião de proposta"
                    className="h-11 sm:h-9"
                    disabled={isSubmitting}
                    {...form.register("title")}
                  />
                  <FieldDescription>
                    Deixe em branco para usar o padrão “Agendamento: nome do
                    cliente”.
                  </FieldDescription>
                </Field>

                <Field className="gap-y-1.5">
                  <FieldLabel
                    htmlFor="notes"
                    className="flex items-center gap-1.5"
                  >
                    <StickyNoteIcon className="size-3.5 text-muted-foreground" />
                    Observações
                  </FieldLabel>
                  <Textarea
                    id="notes"
                    disabled={isSubmitting}
                    placeholder="Observações sobre o compromisso…"
                    rows={3}
                    {...form.register("notes")}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          <DialogFooter className="shrink-0 flex-col gap-2 border-t border-line bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:px-6 sm:py-4">
            {canSubmit && (
              <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground sm:mr-auto sm:justify-start">
                <CheckIcon className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">
                  {selectedDateLabel} às {effectiveTime}
                  {selectedAgenda && <> &mdash; {selectedAgenda.name}</>}
                </span>
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="hidden rounded-full sm:inline-flex"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="h-12 w-full rounded-full text-base sm:h-9 sm:w-auto sm:min-w-40 sm:text-sm"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 size-4" /> Salvando…
                </>
              ) : (
                "Confirmar compromisso"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
