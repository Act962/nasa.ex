"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryAppointment } from "../../hooks/use-appointments";
import {
  useCancelAppointment,
  useCompleteAppointment,
  useDeleteAppointment,
  useRescheduleAppointment,
} from "@/features/agenda/hooks/use-agenda";
import { useQueryPublicAgendaTimeSlots } from "@/features/agenda/hooks/use-public-agenda";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/features/agenda/components/external-link/calendar";
import {
  getLocalTimeZone,
  today,
  CalendarDate,
  parseDate,
} from "@internationalized/date";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
dayjs.extend(timezone);
import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Mail,
  Phone,
  FileText,
  Thermometer,
  Target,
  AlertCircle,
  ArrowUpRight,
  XCircleIcon,
  PencilIcon,
  CheckIcon,
  Trash2Icon,
} from "lucide-react";

/* ─────────────────────────────────────────────── */

const statusMap: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não Compareceu",
  DONE: "Finalizado",
};

const statusColorMap: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  CONFIRMED: "bg-green-100  text-green-800  border-green-200",
  CANCELLED: "bg-red-100    text-red-800    border-red-200",
  NO_SHOW: "bg-red-100    text-red-800    border-red-200",
  DONE: "bg-blue-100   text-blue-800   border-blue-200",
};

const temperatureMap: Record<string, string> = {
  COLD: "Frio",
  WARM: "Morno",
  HOT: "Quente",
  VERY_HOT: "Muito Quente",
};

const temperatureColorMap: Record<string, string> = {
  COLD: "text-blue-500",
  WARM: "text-yellow-500",
  HOT: "text-orange-500",
  VERY_HOT: "text-red-500",
};

/* ─────────────────────────────────────────────── */

interface ViewAppointmentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
}

export const ViewAppointment = ({
  open,
  onOpenChange,
  appointmentId,
}: ViewAppointmentProps) => {
  const { appointment, isLoading } = useQueryAppointment({ appointmentId });
  const { data: session } = authClient.useSession();
  const { data: activeOrganization } = authClient.useActiveOrganization();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  const cancelMutation = useCancelAppointment();
  const completeMutation = useCompleteAppointment();
  const deleteMutation = useDeleteAppointment();

  const handleConfirmCancel = () => {
    cancelMutation.mutate(
      { appointmentId },
      {
        onSuccess: () => {
          setCancelOpen(false);
          onOpenChange(false);
        },
      },
    );
  };

  const handleConfirmComplete = () => {
    completeMutation.mutate(
      { appointmentId },
      {
        onSuccess: () => {
          setCompleteOpen(false);
          onOpenChange(false);
        },
      },
    );
  };

  const handleConfirmDelete = () => {
    deleteMutation.mutate(
      { appointmentId },
      {
        onSuccess: () => {
          setDeleteOpen(false);
          onOpenChange(false);
        },
      },
    );
  };

  const isCancelled = appointment?.status === "CANCELLED";
  const isDone = appointment?.status === "DONE";
  const currentUserId = session?.user?.id;
  const currentMemberRole =
    (
      activeOrganization?.members as Array<{ userId: string; role: string }>
    )?.find((member) => member.userId === currentUserId)?.role ?? null;
  const isAgendaOwner =
    !!currentUserId &&
    !!appointment?.agenda?.responsibles?.some(
      (responsible: { userId: string }) => responsible.userId === currentUserId,
    );
  const isOrgManager =
    !!currentMemberRole &&
    ["owner", "admin", "moderador"].includes(currentMemberRole);
  const isAppointmentCreator =
    !!currentUserId && appointment?.userId === currentUserId;
  const canDeleteAppointment =
    isAgendaOwner || isOrgManager || isAppointmentCreator;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="md:max-w-lg lg:max-w-xl overflow-y-auto flex flex-col">
          <SheetHeader className="mb-4">
            <SheetTitle>Detalhes do Agendamento</SheetTitle>
          </SheetHeader>

          {isLoading ? (
            <div className="space-y-6 flex-1">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : appointment ? (
            <div className="flex flex-col px-4 flex-1 gap-0">
              {/* ── Header ── */}
              <div className="flex flex-col gap-2 px-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold leading-tight flex-1">
                    {appointment.title}
                  </h2>
                  <Badge
                    variant="outline"
                    className={cn(
                      "whitespace-nowrap text-xs",
                      statusColorMap[appointment.status ?? ""] ?? "",
                    )}
                  >
                    {statusMap[appointment.status ?? ""] ?? appointment.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarIcon className="size-4" />
                    {dayjs(appointment.startsAt).format("DD/MM/YYYY")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" />
                    {dayjs(appointment.startsAt).format("HH:mm")} –{" "}
                    {dayjs(appointment.endsAt).format("HH:mm")}
                  </span>
                </div>
              </div>

              {/* ── Action buttons ── */}
              {(!isCancelled || canDeleteAppointment) && (
                <div className="flex flex-wrap gap-2 mt-4 mb-2 px-1">
                  {!isCancelled && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5"
                      onClick={() => setRescheduleOpen(true)}
                      disabled={isDone}
                    >
                      <PencilIcon className="size-3.5" />
                      Reagendar
                    </Button>
                  )}
                  {!isCancelled && !isDone && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5"
                      onClick={() => setCompleteOpen(true)}
                    >
                      <CheckIcon className="size-3.5" />
                      Concluir
                    </Button>
                  )}
                  {!isCancelled && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5"
                      onClick={() => setCancelOpen(true)}
                      disabled={isDone}
                    >
                      <XCircleIcon className="size-3.5" />
                      Cancelar
                    </Button>
                  )}
                  {canDeleteAppointment && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 gap-1.5"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2Icon className="size-3.5" />
                      Deletar
                    </Button>
                  )}
                </div>
              )}

              <Separator className="my-4" />

              {/* ── Lead info ── */}
              {appointment.lead && (
                <div className="space-y-3 px-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Informações do Cliente
                  </p>
                  <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {appointment.lead.name}
                      </span>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        asChild
                        className="ml-auto"
                      >
                        <Link href={`/contatos/${appointment.leadId}`}>
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                    {appointment.lead.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="size-4 text-muted-foreground" />
                        <span className="text-sm text-foreground/80">
                          {appointment.lead.email}
                        </span>
                      </div>
                    )}
                    {appointment.lead.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="size-4 text-muted-foreground" />
                        <span className="text-sm text-foreground/80">
                          {appointment.lead.phone}
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-1">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          Temperatura
                        </span>
                        <div
                          className={cn(
                            "flex items-center gap-1.5 text-sm font-medium",
                            temperatureColorMap[appointment.lead.temperature] ??
                              "text-muted-foreground",
                          )}
                        >
                          <Thermometer className="size-3.5" />
                          {temperatureMap[appointment.lead.temperature] ??
                            appointment.lead.temperature ??
                            "-"}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          Origem
                        </span>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/70">
                          <Target className="size-3.5 text-muted-foreground" />
                          {appointment.lead.source ?? "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              {/* ── Context ── */}
              <div className="space-y-2 px-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Contexto
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Tracking
                    </span>
                    <p className="text-sm font-medium">
                      {appointment.tracking?.name ?? "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Agenda
                    </span>
                    <p className="text-sm font-medium">
                      {appointment.agenda?.name ?? "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Notes ── */}
              {appointment.notes && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2 px-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="size-3.5" /> Notas
                    </p>
                    <div className="bg-yellow-500/5 p-3 rounded-lg border border-yellow-500/20">
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                        {appointment.notes}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <AlertCircle className="size-8 mb-3 opacity-20" />
              <p className="text-sm">Agendamento não encontrado.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Confirmação de cancelamento ── */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agendamento de{" "}
              <strong>{appointment?.lead?.name ?? "cliente"}</strong> em{" "}
              <strong>
                {appointment
                  ? dayjs(appointment.startsAt).format("DD/MM/YYYY [às] HH:mm")
                  : ""}
              </strong>{" "}
              será marcado como cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              Manter agendamento
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending && <Spinner className="mr-2 size-4" />}
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Este agendamento de{" "}
              <strong>{appointment?.lead?.name ?? "cliente"}</strong> será
              marcado como finalizado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completeMutation.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmComplete}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending && (
                <Spinner className="mr-2 size-4" />
              )}
              Sim, concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agendamento de{" "}
              <strong>{appointment?.lead?.name ?? "cliente"}</strong> será
              removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Spinner className="mr-2 size-4" />}
              Sim, deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reagendar (data + horário) ── */}
      {appointment && (
        <RescheduleDialog
          open={rescheduleOpen}
          onClose={() => setRescheduleOpen(false)}
          appointmentId={appointmentId}
          currentStartsAt={new Date(appointment.startsAt)}
          orgSlug={(appointment.agenda as any)?.organization?.slug ?? ""}
          agendaSlug={appointment.agenda?.slug ?? ""}
          onSuccess={() => {
            setRescheduleOpen(false);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
};

/* ─── RescheduleDialog ─────────────────────────────────────────── */

interface RescheduleDialogProps {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  currentStartsAt: Date;
  orgSlug: string;
  agendaSlug: string;
  onSuccess: () => void;
}

function RescheduleDialog({
  open,
  onClose,
  appointmentId,
  currentStartsAt,
  orgSlug,
  agendaSlug,
  onSuccess,
}: RescheduleDialogProps) {
  const reschedule = useRescheduleAppointment();

  const [selectedDate, setSelectedDate] = useState<CalendarDate>(
    parseDate(dayjs(currentStartsAt).format("YYYY-MM-DD")),
  );
  const [selectedTime, setSelectedTime] = useState<string>(
    dayjs(currentStartsAt).format("HH:mm"),
  );

  const dateStr = selectedDate.toString();

  const { timeSlots, isLoading: isLoadingSlots } =
    useQueryPublicAgendaTimeSlots(
      orgSlug && agendaSlug
        ? { orgSlug, agendaSlug, date: dateStr }
        : { orgSlug: "", agendaSlug: "", date: dateStr },
    );

  const handleSave = () => {
    if (!selectedTime) return;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const newStart =
      typeof (dayjs as any).tz === "function"
        ? (dayjs as any).tz(`${dateStr} ${selectedTime}`, timeZone).toDate()
        : new Date(`${dateStr}T${selectedTime}:00`);
    // keep duration = 60min fallback
    const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);

    reschedule.mutate(
      {
        appointmentId,
        startsAt: newStart.toISOString(),
        endsAt: newEnd.toISOString(),
      },
      { onSuccess },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full md:max-w-[640px] p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <DialogTitle>Reagendar Agendamento</DialogTitle>
        </DialogHeader>

        <div className="flex flex-row">
          {/* Calendar */}
          <div className=" p-5 border-r flex flex-col">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-3">
              <CalendarIcon className="size-3.5" /> Selecione a nova data
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

          {/* Time slots */}
          <div className="flex-1 p-5 flex flex-col min-w-0">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-3">
              <Clock className="size-3.5" />
              {dayjs(selectedDate.toDate(getLocalTimeZone())).format(
                "DD/MM/YYYY",
              )}
            </p>

            {isLoadingSlots ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" /> Carregando horários...
              </div>
            ) : timeSlots && timeSlots.length > 0 ? (
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-60 pr-1 flex-1">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedTime(slot.startTime)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border text-sm font-medium py-2.5 px-3 transition-all text-left",
                      selectedTime === slot.startTime
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary hover:bg-primary/5",
                    )}
                  >
                    <Clock
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
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <Clock className="size-7 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Sem horários disponíveis.
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  Escolha outra data.
                </p>
              </div>
            )}

            {selectedTime && (
              <p className="mt-3 text-xs text-primary font-medium flex items-center gap-1.5">
                <CheckIcon className="size-3.5" /> Selecionado:{" "}
                <strong>{selectedTime}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end px-6 py-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={reschedule.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedTime || reschedule.isPending}
            className="min-w-[140px]"
          >
            {reschedule.isPending && <Spinner className="mr-2 size-4" />}
            Salvar Reagendamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── DeleteAppointmentDialog (legacy) ─────────────────────────── */
export function DeleteAppointmentDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <button onClick={() => setOpen(true)}>{children}</button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deletar agendamento</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja deletar este agendamento?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground">
            Deletar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
