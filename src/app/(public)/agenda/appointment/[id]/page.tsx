"use client";

import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import relativeTime from "dayjs/plugin/relativeTime";
import { toast } from "sonner";

dayjs.locale("pt-br");
dayjs.extend(relativeTime);

const statusLabel: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: "Confirmado", color: "bg-green-500/10 text-green-600 border-green-200" },
  PENDING: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-200" },
  CANCELLED: { label: "Cancelado", color: "bg-red-500/10 text-red-600 border-red-200" },
  RESCHEDULED: { label: "Reagendado", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
};

export default function PublicAppointmentPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);

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
  const status = statusLabel[appt.status] ?? { label: appt.status, color: "" };
  const isCancelled = appt.status === "CANCELLED";
  const bookingUrl = `/agenda/${org.slug}/${appt.agenda.slug}`;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4 gap-6">
      {/* Org header */}
      <div className="flex items-center gap-3">
        {org.logoUrl ? (
          <img src={org.logoUrl} alt={org.name} className="size-10 rounded-full object-cover" />
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
              {isCancelled ? (
                <XCircleIcon className="size-3 mr-1" />
              ) : (
                <CheckCircleIcon className="size-3 mr-1" />
              )}
              {status.label}
            </Badge>
          </div>

          {/* Date & time */}
          <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
              <span className="font-medium">
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

          {/* Actions */}
          {!isCancelled && (
            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.href = bookingUrl}
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

          {isCancelled && (
            <Button
              className="w-full"
              onClick={() => window.location.href = bookingUrl}
            >
              <CalendarPlusIcon className="size-4 mr-2" />
              Agendar novamente
            </Button>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Powered by NASA Agents
      </p>
    </div>
  );
}
