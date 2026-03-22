"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useQueryAppointment } from "../../hooks/use-appointments";
import { Skeleton } from "@/components/ui/skeleton";
import dayjs from "dayjs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  FileText,
  Thermometer,
  Target,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ViewAppointment {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
}

const statusMap: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELED: "Cancelado",
  FINISHED: "Finalizado",
  NO_SHOW: "Não Compareceu",
};

const temperatureMap: Record<string, string> = {
  COLD: "Frio",
  WARM: "Morno",
  HOT: "Quente",
  VERY_HOT: "Muito Quente",
};

export const ViewAppointment = ({
  open,
  onOpenChange,
  appointmentId,
}: ViewAppointment) => {
  const { appointment, isLoading } = useQueryAppointment({ appointmentId });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200/80";
      case "CONFIRMED":
        return "bg-green-100 text-green-800 border-green-200 hover:bg-green-200/80";
      case "CANCELED":
      case "NO_SHOW":
        return "bg-red-100 text-red-800 border-red-200 hover:bg-red-200/80";
      case "FINISHED":
        return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200/80";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200/80";
    }
  };

  const getTemperatureColor = (temp: string) => {
    switch (temp) {
      case "COLD":
        return "text-blue-500";
      case "WARM":
        return "text-yellow-500";
      case "HOT":
        return "text-orange-500";
      case "VERY_HOT":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="md:max-w-lg lg:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Detalhes do Agendamento</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <Separator />
            <div className="space-y-4 pt-2">
              <Skeleton className="h-4 w-1/4" />
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4 pt-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Separator />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : appointment ? (
          <div className="space-y-6 px-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-semibold text-foreground leading-tight">
                  {appointment.title}
                </h2>
                <Badge
                  variant="outline"
                  className={`text-center whitespace-nowrap ${getStatusColor(
                    appointment.status || "",
                  )}`}
                >
                  {statusMap[appointment.status || ""] ||
                    appointment.status ||
                    "N/A"}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {dayjs(appointment.startsAt).format("DD/MM/YYYY")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>
                    {dayjs(appointment.startsAt).format("HH:mm")} -{" "}
                    {dayjs(appointment.endsAt).format("HH:mm")}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {appointment.lead && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Informações do Lead
                </h3>
                <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      {appointment.lead.name}
                    </span>

                    <Button
                      size="icon-xs"
                      variant="ghost"
                      asChild
                      className="ml-auto"
                    >
                      <Link href={`/contatos/${appointment.leadId}`}>
                        <ArrowUpRight />
                      </Link>
                    </Button>
                  </div>

                  {appointment.lead.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground/80">
                        {appointment.lead.email}
                      </span>
                    </div>
                  )}

                  {appointment.lead.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground/80">
                        {appointment.lead.phone}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mt-2 pt-3 border-t">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        Temperatura
                      </span>
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Thermometer
                          className={`w-3.5 h-3.5 ${getTemperatureColor(
                            appointment.lead.temperature,
                          )}`}
                        />
                        <span>
                          {temperatureMap[appointment.lead.temperature] ||
                            appointment.lead.temperature ||
                            "-"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        Origem
                      </span>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/70">
                        <Target className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{appointment.lead.source || "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Contexto
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    Tracking
                  </span>
                  <p className="text-sm font-medium text-foreground/80">
                    {appointment.tracking?.name || "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Agenda</span>
                  <p className="text-sm font-medium text-foreground/80">
                    {appointment.agenda?.name || "-"}
                  </p>
                </div>
              </div>
            </div>

            {appointment.notes && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    Notas
                  </h3>
                  <div className="bg-yellow-500/5 dark:bg-yellow-500/10 p-4 rounded-lg border border-yellow-500/20">
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {appointment.notes}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mb-3 opacity-20" />
            <p className="text-sm">Agendamento não encontrado.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
