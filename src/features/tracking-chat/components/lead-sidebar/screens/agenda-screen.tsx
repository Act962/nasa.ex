"use client";

import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeadAppointments } from "@/features/leads/hooks/use-lead-chat-sidebar";
import { ScreenList, ScreenRow, formatDateTime } from "./screen-list";

const AllAppointmentsCalendar = dynamic(
  () => import("@/features/agenda/components/all-appointments-calendar").then((module) => module.AllAppointmentsCalendar),
  { ssr: false },
);

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
  DONE: "Realizado",
};

interface AgendaScreenProps {
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
  leadEmail?: string | null;
}

export function AgendaScreen({ leadId, leadName, leadPhone, leadEmail }: AgendaScreenProps) {
  const { data, isLoading, refetch } = useLeadAppointments(leadId);
  const appointments = data?.appointments ?? [];

  return (
    <Tabs defaultValue="list" className="flex h-full flex-col">
      <TabsList className="w-fit">
        <TabsTrigger value="list">Compromissos</TabsTrigger>
        <TabsTrigger value="calendar">Calendário</TabsTrigger>
      </TabsList>
      <TabsContent value="list" className="mt-3 overflow-y-auto">
        <ScreenList isLoading={isLoading} isEmpty={appointments.length === 0} emptyText="Nenhum compromisso com este lead.">
          {appointments.map((appointment) => (
            <ScreenRow
              key={appointment.id}
              title={appointment.title || "Compromisso"}
              subtitle={`${formatDateTime(appointment.startsAt)} · ${appointment.agenda.name}`}
              badge={<Badge variant="secondary">{APPOINTMENT_STATUS_LABELS[appointment.status] ?? appointment.status}</Badge>}
            />
          ))}
        </ScreenList>
      </TabsContent>
      <TabsContent value="calendar" className="mt-3 min-h-0 flex-1 overflow-y-auto">
        <AllAppointmentsCalendar
          leadName={leadName}
          leadPhone={leadPhone ?? undefined}
          leadEmail={leadEmail ?? undefined}
          onAppointmentCreated={() => refetch()}
        />
      </TabsContent>
    </Tabs>
  );
}
