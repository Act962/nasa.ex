"use client";

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { Calendar, Clock, FolderOpen, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import type { AgendaAppointment } from "./agenda-month-calendar";

dayjs.locale("pt-br");

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
  DONE: "Concluído",
};

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  CONFIRMED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  CANCELLED: "bg-red-500/15 text-red-700 dark:text-red-300",
  NO_SHOW: "bg-red-500/15 text-red-700 dark:text-red-300",
  DONE: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
};

interface AgendaEventListProps {
  appointments: AgendaAppointment[];
  agendaColorMap: Record<string, string>;
  selectedId?: string | null;
  onSelect: (a: AgendaAppointment) => void;
}

interface EventCardProps {
  appt: AgendaAppointment;
  color: string;
  selected: boolean;
  onSelect: (a: AgendaAppointment) => void;
}

function EventCard({ appt, color, selected, onSelect }: EventCardProps) {
  const [coverFailed, setCoverFailed] = useState(false);

  const start = dayjs(appt.startsAt);
  const end = dayjs(appt.endsAt);
  const clientName =
    appt.lead?.name ||
    (appt.title ?? "").replace(/^agendamento:\s*/i, "") ||
    "Agendamento";

  const cover =
    appt.orgProject?.avatar && !coverFailed ? imgSrc(appt.orgProject.avatar) : null;

  const isCancelled = appt.status === "CANCELLED";

  return (
    <button
      type="button"
      onClick={() => onSelect(appt)}
      className={cn(
        "group flex w-full gap-3 rounded-xl border p-3 text-left transition",
        selected
          ? "border-primary/50 bg-primary/10"
          : "border-border/50 bg-card hover:border-primary/30 hover:bg-muted/40",
        isCancelled && "opacity-60",
      )}
    >
      {/* Thumb */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={appt.orgProject?.name ?? ""}
            className="h-full w-full object-cover"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-2xl font-bold text-white drop-shadow"
            style={{ backgroundColor: color }}
          >
            {clientName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-primary">
          <Calendar className="h-2.5 w-2.5" />
          <span className="capitalize">{start.format("DD MMM YYYY")}</span>
        </div>
        <div
          className={cn(
            "truncate text-sm font-semibold leading-tight",
            isCancelled && "line-through",
          )}
        >
          {clientName}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          <span>
            {start.format("HH:mm")} – {end.format("HH:mm")}
          </span>
        </div>
        {appt.agenda?.name && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="truncate">{appt.agenda.name}</span>
          </div>
        )}
        {appt.orgProject?.name && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px]">
            {appt.orgProject.type === "client" ? (
              <UserIcon
                className="h-2.5 w-2.5 shrink-0"
                style={{ color: appt.orgProject.color ?? undefined }}
              />
            ) : (
              <FolderOpen
                className="h-2.5 w-2.5 shrink-0"
                style={{ color: appt.orgProject.color ?? undefined }}
              />
            )}
            <span
              className="truncate font-medium"
              style={{ color: appt.orgProject.color ?? undefined }}
            >
              {appt.orgProject.name}
            </span>
          </div>
        )}
      </div>

      {/* Status badge */}
      <div
        className={cn(
          "shrink-0 self-start rounded-full px-2 py-0.5 text-[10px] font-semibold",
          STATUS_TONE[appt.status] ?? "bg-muted text-muted-foreground",
        )}
      >
        {STATUS_LABEL[appt.status] ?? appt.status}
      </div>
    </button>
  );
}

export function AgendaEventList({
  appointments,
  agendaColorMap,
  selectedId,
  onSelect,
}: AgendaEventListProps) {
  // Agrupa por dia e ordena por horário dentro do dia
  const groups = useMemo(() => {
    const map = new Map<string, AgendaAppointment[]>();
    for (const a of appointments) {
      const key = dayjs(a.startsAt).format("YYYY-MM-DD");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    for (const arr of map.values()) {
      arr.sort(
        (x, y) =>
          new Date(x.startsAt).getTime() - new Date(y.startsAt).getTime(),
      );
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [appointments]);

  const getColor = (a: AgendaAppointment) =>
    agendaColorMap[a.agendaId] ?? "#7c3aed";

  if (groups.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Nenhum agendamento neste período.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
      {groups.map(([dayKey, dayAppts]) => {
        const date = dayjs(dayKey);
        const isToday = date.isSame(dayjs(), "day");
        return (
          <div key={dayKey} className="flex flex-col gap-2">
            <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-background/90 py-1 backdrop-blur">
              <span
                className={cn(
                  "text-sm font-semibold capitalize",
                  isToday && "text-primary",
                )}
              >
                {date.format("dddd, DD [de] MMMM")}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {dayAppts.length}{" "}
                {dayAppts.length === 1 ? "agendamento" : "agendamentos"}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {dayAppts.map((a) => (
                <EventCard
                  key={a.id}
                  appt={a}
                  color={getColor(a)}
                  selected={selectedId === a.id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
