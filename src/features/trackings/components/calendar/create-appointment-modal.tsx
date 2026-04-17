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
  name:  z.string().min(1, "Nome é obrigatório"),
  code:  z.string().optional(),
  phone: z.string().min(1, "Telefone é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const dayMap: DayOfWeek[] = [
  DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY,
];

export function CreateAppointmentModal({ open, onClose, trackingId, initialDate, initialName, initialPhone, initialEmail, onSuccess }: Props) {
  // Load agendas (all org agendas when trackingId is absent)
  const { data: agendasData, isLoading: isLoadingAgendas } =
    useQueryAgendasByTracking(trackingId || undefined);
  const agendas = agendasData?.agendas ?? [];

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedAgendaId, setSelectedAgendaId] = useState("");
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(() =>
    initialDate ? parseDate(dayjs(initialDate).format("YYYY-MM-DD")) : today(getLocalTimeZone()),
  );
  const [selectedTime, setSelectedTime] = useState("");
  const [manualTime, setManualTime]     = useState(""); // fallback when no slots

  const initialPhoneMasked = (() => {
    if (!initialPhone) return "";
    const raw = initialPhone.replace(/\D/g, "").replace(/^55/, "");
    return phoneMask(raw);
  })();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialName ?? "",
      phone: initialPhoneMasked,
      code: "55",
      email: initialEmail ?? "",
      notes: "",
    },
  });

  const selectedCode    = form.watch("code");
  const countrySelected = countries.find((c) => c.code === selectedCode) ?? countries[0];

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedTime("");
      setManualTime("");
      // Extract just the numeric digits from the phone for the masked input
      const rawPhone = initialPhone ? initialPhone.replace(/\D/g, "").replace(/^55/, "") : "";
      const maskedPhone = rawPhone ? phoneMask(rawPhone) : "";
      form.reset({
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
  const dateStr        = selectedDate.toString();

  // Availability logic (for greying out dates)
  const availabilityMap: Partial<Record<DayOfWeek, boolean>> = Object.fromEntries(
    (selectedAgenda?.availabilities ?? []).map((a: any) => [a.dayOfWeek, a.isActive]),
  );
  const blockedDatesSet = new Set(
    (selectedAgenda?.dateOverrides ?? []).filter((d: any) => d.isBlocked).map((d: any) => d.date),
  );
  const isDateUnavailable = (date: DateValue): boolean => {
    if (!selectedAgenda) return false;
    if (blockedDatesSet.has(date.toString())) return true;
    const jsDay = date.toDate(getLocalTimeZone()).getDay();
    const isActive = availabilityMap[dayMap[jsDay]];
    return isActive === undefined ? true : !isActive;
  };

  // Time slots from agenda
  const { timeSlots, isLoading: isLoadingSlots } = useQueryPublicAgendaTimeSlots(
    selectedAgenda
      ? { orgSlug: selectedAgenda.organization.slug, agendaSlug: selectedAgenda.slug, date: dateStr }
      : { orgSlug: "", agendaSlug: "", date: dateStr },
  );

  // Effective time: selected slot OR manual input
  const effectiveTime = selectedTime || manualTime;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const createAdminAppointment = useAdminCreateAppointment();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const onSubmit = (data: FormData) => {
    if (!selectedAgendaId) { form.setError("name", { message: "" }); return; }
    if (!effectiveTime)    return;
    const phone = normalizePhone(countrySelected.ddi + data.phone);
    createAdminAppointment.mutate(
      { agendaId: selectedAgendaId, date: dateStr, time: effectiveTime,
        name: data.name, phone, email: data.email, notes: data.notes, timeZone },
      {
        onSuccess: (data) => {
          onClose();
          onSuccess?.(data.appointment.id);
        },
      },
    );
  };

  const isSubmitting  = createAdminAppointment.isPending;
  const canSubmit     = !!selectedAgendaId && !!effectiveTime;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] sm:max-w-2xl overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <CalendarIcon className="size-4" />
            Novo compromisso
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="px-4 tiny:px-6 py-4 tiny:py-5 space-y-4 tiny:space-y-6">

            {/* ── Seção 1: Agenda + Data + Horário ─────────────────────────── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quando
              </p>

              {/* Agenda selector */}
              {isLoadingAgendas ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" /> Carregando agendas…
                </div>
              ) : agendas.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed text-sm text-muted-foreground">
                  <CalendarIcon className="size-4 shrink-0" />
                  Nenhuma agenda disponível. Crie uma agenda antes de agendar.
                </div>
              ) : agendas.length > 1 ? (
                <Field className="gap-y-1.5">
                  <FieldLabel>Agenda <span className="text-destructive">*</span></FieldLabel>
                  <Select
                    value={selectedAgendaId}
                    onValueChange={(v) => { setSelectedAgendaId(v); setSelectedTime(""); }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione uma agenda…" />
                    </SelectTrigger>
                    <SelectContent>
                      {agendas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                /* Single agenda — show as read-only label */
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border text-sm">
                  <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{agendas[0]?.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">agenda selecionada</span>
                </div>
              )}

              {/* Calendar + time slots side by side */}
              <div className="border rounded-xl overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  {/* Calendar */}
                  <div className="p-2 tiny:p-4 sm:border-r flex flex-col items-start border-b sm:border-b-0">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-3">
                      <CalendarIcon className="size-3.5" /> Data
                    </p>
                    <Calendar
                      minValue={today(getLocalTimeZone())}
                      isDateUnavailable={isDateUnavailable}
                      value={selectedDate}
                      onChange={(d) => { setSelectedDate(d as CalendarDate); setSelectedTime(""); }}
                    />
                  </div>

                  {/* Time slots or manual time input */}
                  <div className="flex-1 p-2 tiny:p-4 flex flex-col min-w-0">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-3">
                      <ClockIcon className="size-3.5" />
                      {dayjs(selectedDate.toDate(getLocalTimeZone())).format("DD/MM/YYYY")}
                    </p>

                    {!selectedAgendaId ? (
                      /* No agenda selected yet */
                      <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                        <CalendarIcon className="size-8 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {agendas.length > 1 ? "Selecione uma agenda para ver os horários" : "Selecione uma data"}
                        </p>
                      </div>
                    ) : isLoadingSlots ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                        <Spinner className="size-4" /> Carregando horários…
                      </div>
                    ) : timeSlots && timeSlots.length > 0 ? (
                      /* Agenda time slots */
                      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-64 pr-1">
                        {timeSlots.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => { setSelectedTime(slot.startTime); setManualTime(""); }}
                            className={cn(
                              "flex items-center gap-2 tiny:gap-3 rounded-lg border text-sm font-medium py-2 tiny:py-2.5 px-2.5 tiny:px-3 transition-all text-left w-full",
                              selectedTime === slot.startTime
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-card hover:border-primary hover:bg-primary/5 text-foreground",
                            )}
                          >
                            <ClockIcon className={cn("size-4 shrink-0", selectedTime === slot.startTime ? "text-primary-foreground" : "text-muted-foreground")} />
                            <span className="flex-1">{slot.startTime}</span>
                            {selectedTime === slot.startTime && <CheckIcon className="size-4 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    ) : (
                      /* No slots — manual time input */
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Nenhum horário configurado para esta data. Informe o horário manualmente:
                        </p>
                        <Input
                          type="time"
                          value={manualTime}
                          onChange={(e) => { setManualTime(e.target.value); setSelectedTime(""); }}
                          className="w-36"
                        />
                      </div>
                    )}

                    {effectiveTime && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-1.5 text-xs text-primary font-medium">
                        <CheckIcon className="size-3.5" />
                        Horário selecionado: <strong>{effectiveTime}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Seção 2: Dados do cliente ─────────────────────────────────── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dados do cliente
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nome */}
                <Field className="gap-y-1.5">
                  <FieldLabel htmlFor="name" className="flex items-center gap-1.5">
                    <UserIcon className="size-3.5 text-muted-foreground" />
                    Nome <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="name"
                    placeholder="Nome completo"
                    disabled={isSubmitting}
                    {...form.register("name")}
                  />
                  {form.formState.errors.name?.message && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </Field>

                {/* Email */}
                <Field className="gap-y-1.5">
                  <FieldLabel htmlFor="email" className="flex items-center gap-1.5">
                    <MailIcon className="size-3.5 text-muted-foreground" />
                    Email
                  </FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="cliente@email.com"
                    disabled={isSubmitting}
                    {...form.register("email")}
                  />
                  {form.formState.errors.email?.message && (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </Field>
              </div>

              {/* Telefone */}
              <Field className="gap-y-1.5">
                <FieldLabel htmlFor="phone" className="flex items-center gap-1.5">
                  <PhoneIcon className="size-3.5 text-muted-foreground" />
                  Telefone <span className="text-destructive">*</span>
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <InputGroup className="px-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            disabled={isSubmitting}
                            type="button"
                            className={cn(
                              "text-xs flex items-center hover:bg-accent transition-all px-1 rounded-sm py-1 gap-x-1",
                              countrySelected && "bg-accent",
                            )}
                          >
                            <img src={countrySelected.flag} alt={countrySelected.country} className="size-4 rounded-sm" />
                            <span>{countrySelected.ddi}</span>
                            <ChevronDownIcon className="size-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="max-h-40 overflow-y-auto">
                          <DropdownMenuGroup>
                            {countries.map((country) => (
                              <DropdownMenuItem
                                key={country.code}
                                onClick={() => form.setValue("code" as any, country.code)}
                                className="cursor-pointer"
                              >
                                <img src={country.flag} alt={country.country} className="size-5 rounded-sm" />
                                <span>{country.ddi}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <InputGroupInput
                        placeholder="(00) 0000-0000"
                        className="pl-2"
                        disabled={isSubmitting}
                        {...field}
                        onChange={(e) => field.onChange(phoneMask(e.target.value))}
                      />
                    </InputGroup>
                  )}
                />
                <FieldDescription>
                  {form.formState.errors.phone?.message ?? "Formato (00) 0000-0000, sem o 9"}
                </FieldDescription>
              </Field>

              {/* Observações */}
              <Field className="gap-y-1.5">
                <FieldLabel htmlFor="notes" className="flex items-center gap-1.5">
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

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          <DialogFooter className="px-4 tiny:px-6 py-3 tiny:py-4 border-t gap-2 flex-col-reverse tiny:flex-row">
            {/* Summary pill */}
            {canSubmit && (
              <span className="mr-auto text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                <CheckIcon className="size-3.5 text-primary" />
                {dayjs(selectedDate.toDate(getLocalTimeZone())).format("DD/MM/YYYY")} às {effectiveTime}
                {selectedAgenda && <> &mdash; {selectedAgenda.name}</>}
              </span>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full tiny:w-auto">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="w-full tiny:min-w-[160px]"
            >
              {isSubmitting ? (
                <><Spinner className="mr-2 size-4" /> Salvando…</>
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
