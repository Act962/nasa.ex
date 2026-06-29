"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  AgendaMonthCalendar,
  type AgendaAppointment,
} from "@/features/agenda/components/agenda-month-calendar";
import { useSuspenseAgendas } from "@/features/agenda/hooks/use-agenda";

interface Props {
  trackingId: string;
}

/**
 * Página de agendamentos do Tracking — usa o mesmo padrão visual da página
 * `/agendas` (AgendaMonthCalendar com 2 colunas, drag&drop, ícone Online/
 * Presencial cortando à direita, lista mobile etc.), porém escopado a um
 * único tracking.
 */
export function AppointmentCalendar({ trackingId }: Props) {
  // Lista de agendas — pra dropdown de filtro e cor por agenda. Usa o
  // suspense já existente; o parent é Server Component, então o suspense
  // boundary fica no próprio AgendaMonthCalendar via React Query.
  const { data: agendasData } = useSuspenseAgendas();
  const agendas = agendasData.agendas;

  // Appointments do tracking corrente (com lead/agenda/orgProject incluídos
  // pelo handler `getAppointmentsByTracking`).
  const { data, isLoading } = useQuery(
    orpc.agenda.appointments.getManyByTracking.queryOptions({
      input: { trackingId },
    }),
  );

  const appointments = (data?.appointments ?? []) as unknown as AgendaAppointment[];

  return (
    <div className="h-full w-full px-6 py-4">
      <main className="relative flex h-[calc(100vh-9rem)] min-h-[600px] w-full flex-col rounded-xl border bg-card/30">
        <AgendaMonthCalendar
          agendas={agendas}
          appointments={appointments}
          isLoading={isLoading}
          trackingId={trackingId}
        />
      </main>
    </div>
  );
}
