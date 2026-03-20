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

export function AppointmentCalendar() {
  const [value, setValue] = useState<Date>(new Date());

  const handleNavigate = (newDate: Date) => {
    setValue(newDate);
  };

  const appointments = [
    {
      title: "TESTE",
      start: new Date(),
      end: new Date(),
    },
  ];

  return (
    <div className="h-full w-full px-4 py-2">
      <Calendar
        localizer={localizer}
        date={value}
        onNavigate={handleNavigate}
        events={appointments}
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
      />
    </div>
  );
}
