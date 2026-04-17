"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { orpc } from "@/lib/orpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
  XCircleIcon,
  CalendarPlusIcon,
  BuildingIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  AlertCircleIcon,
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import relativeTime from "dayjs/plugin/relativeTime";
import { toast } from "sonner";
import {
  addMonths,
  format,
  getDay,
  parse,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDate,
  getLocalTimeZone,
  parseDate,
  today,
} from "@internationalized/date";
import { Calendar } from "@/features/agenda/components/external-link/calendar";
import { useQueryPublicAgendaTimeSlots } from "@/features/agenda/hooks/use-public-agenda";
import { cn } from "@/lib/utils";

dayjs.locale("pt-br");
dayjs.extend(relativeTime);

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  CONFIRMED: {
    label: "Confirmado",
    color: "bg-green-500/10 text-green-600 border-green-200",
    icon: <CheckCircleIcon className="size-3 mr-1" />,
  },
  PENDING: {
    label: "Pendente",
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
    icon: <AlertCircleIcon className="size-3 mr-1" />,
  },
  CANCELLED: {
    label: "Cancelado",
    color: "bg-red-500/10 text-red-600 border-red-200",
    icon: <XCircleIcon className="size-3 mr-1" />,
  },
  RESCHEDULED: {
    label: "Reagendado",
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
    icon: <CalendarPlusIcon className="size-3 mr-1" />,
  },
};

// ─── Reschedule panel ─────────────────────────────────────────────────────────

function ReschedulePanel({
  appointmentId,
  orgSlug,
  agendaSlug,
  onSuccess,
  onCancel,
}: {
  appointmentId: string;
  orgSlug: string;
  agendaSlug: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(today(getLocalTimeZone()));
  const [selectedTime, setSelectedTime] = useState("");

  const { timeSlots, isLoading: isLoadingSlots } = useQueryPublicAgendaTimeSlots({
    orgSlug,
    agendaSlug,
    date: selectedDate.toString(),
  });

  const rescheduleMutation = useMutation(
    orpc.agenda.public.appointment.reschedule.mutationOptions({
      onSuccess: () => {
        toast.success("Compromisso reagendado com sucesso!");
        onSuccess();
      },
      onError: (err) => toast.error("Erro ao reagendar: " + err.message),
    }),
  );

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Escolha o novo horário
      </p>

      <div className="border rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Calendário */}
          <div className="p-3 sm:border-r flex flex-col items-start border-b sm:border-b-0">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-3">
              <CalendarIcon className="size-3.5" /> Data
            </p>
            <Calendar
              minValue={today(getLocalTimeZone())}
              value={selectedDate}
              onChange={(d) => {
                setSelectedDate(d as CalendarDate);
                setSelectedTime("");
              }}
            />
          </div>

          {/* Horários */}
          <div className="flex-1 p-3 flex flex-col min-w-0">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-3">
              <ClockIcon className="size-3.5" />
              {dayjs(selectedDate.toDate(getLocalTimeZone())).format("DD/MM/YYYY")}
            </p>

            {isLoadingSlots ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Spinner className="size-4" /> Carregando horários…
              </div>
            ) : timeSlots && timeSlots.length > 0 ? (
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-52 pr-1">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedTime(slot.startTime)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border text-sm font-medium py-2 px-3 transition-all text-left w-full",
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
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                <ClockIcon className="size-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum horário disponível para esta data
                </p>
              </div>
            )}

            {selectedTime && (
              <div className="mt-3 pt-3 border-t flex items-center gap-1.5 text-xs text-primary font-medium">
                <CheckIcon className="size-3.5" />
                Horário selecionado: <strong>{selectedTime}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={rescheduleMutation.isPending}>
          Voltar
        </Button>
        <Button
          className="flex-1"
          disabled={!selectedTime || rescheduleMutation.isPending}
          onClick={() =>
            rescheduleMutation.mutate({
              appointmentId,
              date: selectedDate.toString(),
              time: selectedTime,
              timeZone,
            })
          }
        >
          {rescheduleMutation.isPending ? (
            <><Spinner className="size-4 mr-2" /> Salvando…</>
          ) : (
            "Confirmar reagendamento"
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PublicAppointmentPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  const { data, isLoading, isError } = useQuery(
    orpc.agenda.public.appointment.get.queryOptions({ input: { appointmentId: id } }),
  );

  const cancelMutation = useMutation(
    orpc.agenda.public.appointment.cancel.mutationOptions({
      onSuccess: () => {
        toast.success("Compromisso cancelado com sucesso.");
        queryClient.invalidateQueries(
          orpc.agenda.public.appointment.get.queryOptions({ input: { appointmentId: id } }),
        );
        setConfirmCancel(false);
      },
      onError: (err) => toast.error("Erro ao cancelar: " + err.message),
    }),
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (isError || !data?.appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 flex flex-col items-center text-center gap-3">
            <XCircleIcon className="size-12 text-muted-foreground/40" />
            <p className="text-lg font-semibold">Compromisso não encontrado</p>
            <p className="text-sm text-muted-foreground">
              O link pode ter expirado ou o compromisso foi removido.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const appt = data.appointment;
  const org = appt.agenda.organization;
  const status = statusConfig[appt.status] ?? {
    label: appt.status,
    color: "",
    icon: null,
  };
  const isCancelled = appt.status === "CANCELLED";

  // Quem cancelou
  const cancelledByLabel =
    appt.cancelledBy === "CLIENT"
      ? "Cancelado pelo cliente"
      : appt.cancelledBy === "SYSTEM"
      ? "Cancelado pelo sistema"
      : null;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4 gap-6">
      {/* Org header */}
      <div className="flex items-center gap-3">
        {org.logo ? (
          <img src={org.logo} alt={org.name} className="size-10 rounded-full object-cover" />
        ) : (
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
            <BuildingIcon className="size-5 text-primary" />
          </div>
        )}
        <span className="font-semibold text-base">{org.name}</span>
      </div>

      <Card className="max-w-md w-full shadow-lg">
        <CardContent className="py-6 px-6 space-y-5">

          {/* Status */}
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold">{appt.agenda.name}</h1>
            <Badge className={`text-xs border ${status.color}`} variant="outline">
              {status.icon}
              {status.label}
            </Badge>
          </div>

          {/* Quem cancelou */}
          {isCancelled && cancelledByLabel && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/40 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              <XCircleIcon className="size-4 shrink-0" />
              {cancelledByLabel}
            </div>
          )}

          {/* Date & time */}
          <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
              <span className="font-medium capitalize">
                {dayjs(appt.startsAt).format("dddd, DD [de] MMMM [de] YYYY")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ClockIcon className="size-4 text-muted-foreground shrink-0" />
              <span>
                {dayjs(appt.startsAt).format("HH:mm")} – {dayjs(appt.endsAt).format("HH:mm")}
                <span className="ml-2 text-xs text-muted-foreground">
                  ({appt.agenda.slotDuration} min)
                </span>
              </span>
            </div>
          </div>

          {/* Lead info */}
          {appt.lead && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Seus dados
              </p>
              <div className="space-y-1.5">
                {appt.lead.name && (
                  <div className="flex items-center gap-2 text-sm">
                    <UserIcon className="size-4 text-muted-foreground shrink-0" />
                    <span>{appt.lead.name}</span>
                  </div>
                )}
                {appt.lead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <PhoneIcon className="size-4 text-muted-foreground shrink-0" />
                    <span>{appt.lead.phone}</span>
                  </div>
                )}
                {appt.lead.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <MailIcon className="size-4 text-muted-foreground shrink-0" />
                    <span>{appt.lead.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {appt.notes && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              {appt.notes}
            </div>
          )}

          {/* ── Reagendamento inline ── */}
          {!isCancelled && showReschedule && (
            <ReschedulePanel
              appointmentId={id}
              orgSlug={org.slug}
              agendaSlug={appt.agenda.slug}
              onSuccess={() => {
                setShowReschedule(false);
                queryClient.invalidateQueries(
                  orpc.agenda.public.appointment.get.queryOptions({ input: { appointmentId: id } }),
                );
              }}
              onCancel={() => setShowReschedule(false)}
            />
          )}

          {/* ── Ações ── */}
          {!isCancelled && !showReschedule && (
            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setConfirmCancel(false);
                  setShowReschedule(true);
                }}
              >
                <CalendarPlusIcon className="size-4 mr-2" />
                Reagendar compromisso
              </Button>

              {!confirmCancel ? (
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmCancel(true)}
                >
                  <XCircleIcon className="size-4 mr-2" />
                  Cancelar compromisso
                </Button>
              ) : (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                  <p className="text-sm text-center font-medium text-destructive">
                    Confirmar cancelamento?
                  </p>
                  <p className="text-xs text-center text-muted-foreground">
                    Esta ação não pode ser desfeita.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setConfirmCancel(false)}
                      disabled={cancelMutation.isPending}
                    >
                      Voltar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate({ appointmentId: id })}
                    >
                      {cancelMutation.isPending ? <Spinner className="size-4" /> : "Confirmar"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Cancelado: opção de reagendar ── */}
          {isCancelled && (
            <div className="space-y-3">
              {showReschedule ? (
                <ReschedulePanel
                  appointmentId={id}
                  orgSlug={org.slug}
                  agendaSlug={appt.agenda.slug}
                  onSuccess={() => {
                    setShowReschedule(false);
                    queryClient.invalidateQueries(
                      orpc.agenda.public.appointment.get.queryOptions({ input: { appointmentId: id } }),
                    );
                  }}
                  onCancel={() => setShowReschedule(false)}
                />
              ) : (
                <Button className="w-full" onClick={() => setShowReschedule(true)}>
                  <CalendarPlusIcon className="size-4 mr-2" />
                  Reagendar compromisso
                </Button>
              )}
            </div>
          )}

        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Powered by NASA Agents</p>
    </div>
  );
}
