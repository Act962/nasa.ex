"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { DayOfWeek } from "@/generated/prisma/enums";
import { countries } from "@/types/some";
import { normalizePhone, phoneMask } from "@/utils/format-phone";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  CalendarIcon,
  ClockIcon,
  CheckIcon,
} from "lucide-react";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Quando omitido, exibe step 0 para seleção de tracking */
  trackingId?: string;
  initialDate?: Date;
}

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().optional(),
  phone: z.string().min(1, "Telefone é obrigatório"),
  email: z.email("Email inválido").optional().or(z.literal("")),
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

export function CreateAppointmentModal({
  open,
  onClose,
  trackingId,
  initialDate,
}: Props) {
  const { data: agendasData, isLoading: isLoadingAgendas } =
    useQueryAgendasByTracking(trackingId || "");
  const agendas = agendasData?.agendas ?? [];

  // When no trackingId is provided (e.g. from the global calendar),
  // the user doesn't need to pick a tracking — we load all org agendas instead.
  const needsTrackingPick = false; // step 0 removed: agendas load by org when trackingId is absent
  const [resolvedTrackingId, setResolvedTrackingId] = useState<string>(trackingId ?? "");

  const [selectedAgendaId, setSelectedAgendaId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(() =>
    initialDate
      ? parseDate(dayjs(initialDate).format("YYYY-MM-DD"))
      : today(getLocalTimeZone()),
  );
  const [selectedTime, setSelectedTime] = useState<string>("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", phone: "", code: "55", email: "", notes: "" },
  });

  const selectedCode = form.watch("code");
  const countrySelected =
    countries.find((c) => c.code === selectedCode) || countries[0];

  useEffect(() => {
    if (open) {
      setSelectedTime("");
      setSelectedAgendaId("");
      form.reset({ name: "", phone: "", code: "55", email: "", notes: "" });
      if (initialDate)
        setSelectedDate(parseDate(dayjs(initialDate).format("YYYY-MM-DD")));
    }
  }, [open, initialDate, trackingId]);

  useEffect(() => {
    if (agendas.length === 1) setSelectedAgendaId(agendas[0].id);
  }, [agendas]);

  const selectedAgenda = agendas.find((a) => a.id === selectedAgendaId);
  const dateStr = selectedDate.toString();

  const { timeSlots, isLoading: isLoadingSlots } =
    useQueryPublicAgendaTimeSlots(
      selectedAgenda
        ? {
            orgSlug: selectedAgenda.organization.slug,
            agendaSlug: selectedAgenda.slug,
            date: dateStr,
          }
        : { orgSlug: "", agendaSlug: "", date: dateStr },
    );

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
    if (isActive === undefined) return true;
    return !isActive;
  };

  const createAdminAppointment = useAdminCreateAppointment();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const onSubmit = (data: FormData) => {
    if (!selectedAgendaId || !selectedTime) return;
    const phone = normalizePhone(countrySelected.ddi + data.phone);
    createAdminAppointment.mutate(
      {
        agendaId: selectedAgendaId,
        date: dateStr,
        time: selectedTime,
        name: data.name,
        phone,
        email: data.email,
        notes: data.notes,
        timeZone,
      },
      { onSuccess: () => onClose() },
    );
  };

  const isSubmitting = createAdminAppointment.isPending;
  const showCalendar = !!selectedAgendaId;
  const showForm = showCalendar && !!selectedTime;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] sm:max-w-4xl overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg font-semibold">
            Novo Agendamento
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-6">
          {/* ── Step 1: Agenda ── */}
          {/* {(!needsTrackingPick ) && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </span>
              <span className="text-sm font-semibold">Selecione a agenda</span>
            </div>
            {isLoadingAgendas ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Spinner className="size-4" /> Carregando agendas...
              </div>
            ) : (
              <Select
                value={selectedAgendaId}
                onValueChange={(v) => {
                  setSelectedAgendaId(v);
                  setSelectedTime("");
                }}
              >
                <SelectTrigger className="w-full sm:max-w-xs">
                  <SelectValue placeholder="Escolha uma agenda..." />
                </SelectTrigger>
                <SelectContent>
                  {agendas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                  {agendas.length === 0 && (
                    <p className="p-2 text-sm text-muted-foreground">
                      Nenhuma agenda ativa
                    </p>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
          )} */}

          {/* ── Step 2: Date + Time ── */}
          {showCalendar && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  2
                </span>
                <span className="text-sm font-semibold">
                  Escolha data e horário
                </span>
              </div>

              <div className="border rounded-xl overflow-hidden">
                {/* Always side-by-side: calendar LEFT | timeslots RIGHT */}
                <div className="flex flex-row">
                  {/* ── Calendar (fixed width) ── */}
                  <div className=" p-4 border-r flex flex-col">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-3">
                      <CalendarIcon className="size-3.5" /> Data
                    </p>
                    <Calendar
                      minValue={today(getLocalTimeZone())}
                      isDateUnavailable={isDateUnavailable}
                      value={selectedDate}
                      onChange={(d) => {
                        setSelectedDate(d as CalendarDate);
                        setSelectedTime("");
                      }}
                    />
                  </div>

                  {/* ── Time slots (fills remaining width) ── */}
                  <div className="flex-1 p-4 flex flex-col min-w-0">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-3">
                      <ClockIcon className="size-3.5" />
                      {dayjs(selectedDate.toDate(getLocalTimeZone())).format(
                        "DD/MM/YYYY",
                      )}
                    </p>

                    {isLoadingSlots ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                        <Spinner className="size-4" /> Carregando...
                      </div>
                    ) : timeSlots && timeSlots.length > 0 ? (
                      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[280px] pr-1">
                        {timeSlots.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedTime(slot.startTime)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border text-sm font-medium py-2.5 px-3 transition-all text-left w-full",
                              selectedTime === slot.startTime
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-card hover:border-primary hover:bg-primary/5 text-foreground",
                            )}
                          >
                            <ClockIcon
                              className={cn(
                                "size-4 shrink-0",
                                selectedTime === slot.startTime
                                  ? "text-primary-foreground"
                                  : "text-muted-foreground",
                              )}
                            />
                            <span className="flex-1">{slot.startTime}</span>
                            {selectedTime === slot.startTime && (
                              <CheckIcon className="size-4 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                        <ClockIcon className="size-8 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Sem horários disponíveis.
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          Escolha outra data.
                        </p>
                      </div>
                    )}

                    {selectedTime && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-1.5 text-xs text-primary font-medium">
                        <CheckIcon className="size-3.5" />
                        Selecionado: <strong>{selectedTime}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Contact form ── */}
          {showForm && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  3
                </span>
                <span className="text-sm font-semibold">Dados do cliente</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {dayjs(selectedDate.toDate(getLocalTimeZone())).format(
                    "DD/MM/YYYY",
                  )}{" "}
                  às {selectedTime}
                </span>
              </div>

              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="border rounded-xl p-4 flex flex-col gap-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field className="gap-y-1.5">
                    <FieldLabel htmlFor="name" className="gap-1">
                      Nome <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="name"
                      placeholder="Nome completo"
                      disabled={isSubmitting}
                      {...form.register("name")}
                    />
                    {form.formState.errors.name && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </Field>

                  <Field className="gap-y-1.5">
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      placeholder="cliente@email.com"
                      disabled={isSubmitting}
                      {...form.register("email")}
                    />
                  </Field>
                </div>

                <Field className="gap-y-1.5">
                  <FieldLabel htmlFor="phone" className="gap-1">
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
                            align="end"
                            className="max-h-40 overflow-y-auto"
                          >
                            <DropdownMenuGroup>
                              {countries.map((country) => (
                                <DropdownMenuItem
                                  key={country.code}
                                  onClick={() =>
                                    form.setValue("code" as any, country.code)
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
                          className="pl-2"
                          disabled={isSubmitting}
                          {...field}
                          onChange={(e) =>
                            field.onChange(phoneMask(e.target.value))
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

                <Field className="gap-y-1.5">
                  <FieldLabel htmlFor="notes">Observações</FieldLabel>
                  <Textarea
                    id="notes"
                    disabled={isSubmitting}
                    placeholder="Observações sobre o agendamento..."
                    rows={3}
                    {...form.register("notes")}
                  />
                </Field>

                <div className="flex gap-3 justify-end pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-w-[160px]"
                  >
                    {isSubmitting && <Spinner className="mr-2 size-4" />}
                    Confirmar Agendamento
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
