"use client";

import {
  addMonths,
  format,
  getDay,
  parse,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "./data-calendar.css";
import { useQueryAppointmentsByTrackfing } from "../../hooks/use-trackings";
import { AppointmentCard } from "./appointment-card";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import dayjs from "dayjs";
import { useLocale } from "react-aria";
import "dayjs/locale/pt-br";

const locales = {
  "pt-BR": ptBR,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Props {
  trackingId: string;
}

export function AppointmentCalendar({ trackingId }: Props) {
  const [value, setValue] = useState<Date>(new Date());
  const { appointments } = useQueryAppointmentsByTrackfing({ trackingId });

  const handleNavigate = (action: "PREV" | "NEXT" | "TODAY") => {
    if (action === "PREV") {
      setValue(subMonths(value, 1));
    } else if (action === "NEXT") {
      setValue(addMonths(value, 1));
    } else if (action === "TODAY") {
      setValue(new Date());
    }
  };

  const events = appointments.map((appointment) => ({
    start: appointment.startsAt,
    end: appointment.endsAt,
    title: appointment.title,
    id: appointment.id,
    status: appointment.status,
  }));

  return (
    <div className="h-full w-full px-4 py-2">
      <Calendar
        localizer={localizer}
        date={value}
        events={events}
        culture="pt-BR"
        views={["month"]}
        defaultView="month"
        toolbar
        showAllEvents
        className=""
        max={new Date(new Date().setFullYear(new Date().getFullYear() + 1))}
        formats={{
          weekdayFormat: (date, culture, localizer) =>
            localizer?.format(date, "EEE", culture) ?? "",
        }}
        messages={{
          today: "Hoje",
          previous: "Anterior",
          next: "Próximo",
          month: "Mês",
          week: "Semana",
          day: "Dia",
          agenda: "Agenda",
          date: "Data",
          time: "Hora",
          event: "Evento",
          noEventsInRange: "Não há eventos neste período",
          showMore: (total) => `+ Ver mais (${total})`,
        }}
        components={{
          eventWrapper: ({ event }) => <AppointmentCard {...event} />,
          toolbar: () => (
            <CustomToolbar date={value} onNavigate={handleNavigate} />
          ),
        }}
      />
    </div>
  );
}

interface CustomToolbarProps {
  date: Date;
  onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
}

function CustomToolbar({ date, onNavigate }: CustomToolbarProps) {
  const { locale } = useLocale();
  return (
    <div className="flex mb-4 gap-x-2 items-center w-full lg:w-auto justify-center lg:justify-start">
      <Button
        onClick={() => onNavigate("PREV")}
        variant="outline"
        size="icon-sm"
        className="flex items-center"
      >
        <ChevronLeftIcon className="size-4" />
      </Button>

      <div className="flex items-center bborder border-input rounded-md px-3 py-2 h-8 justify-center w-full lg:w-auto capitalize">
        <CalendarIcon className="size-4 mr-4" />
        <p className="text-sm">{dayjs(date).locale(locale).format("MMMM")}</p>
      </div>

      <Button
        onClick={() => onNavigate("NEXT")}
        variant="outline"
        size="icon-sm"
        className="flex items-center"
      >
        <ChevronRightIcon className="size-4" />
      </Button>
    </div>
  );
}
