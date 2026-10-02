"use client";

import { useState } from "react";
import { AlarmClock, CalendarDays, FileText, Sparkles, Users } from "lucide-react";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { CreateAppointmentModal } from "../create-appointment-modal";
import { AgendasSheet } from "./agendas-sheet";
import { ContactsSheet, type ContactToSchedule } from "./contacts-sheet";
import { EventsSheet } from "./events-sheet";
import { ProposalsSheet } from "./proposals-sheet";
import { ReminderSheet } from "./reminder-sheet";
import type { QuickMenuAgenda, QuickMenuAppointment, QuickMenuPanel } from "./quick-menu-types";

/** Menu de baixo da Agenda no celular: Propostas, Lembrete, Agendas (centro), Contatos e Eventos — cada um abre a sua gaveta. */
export function AgendaQuickMenu({
  appointments,
  agendas,
  bookingBaseUrl,
}: {
  appointments: QuickMenuAppointment[];
  agendas: QuickMenuAgenda[];
  bookingBaseUrl: string;
}) {
  const [openPanel, setOpenPanel] = useState<QuickMenuPanel | null>(null);
  const [contactToSchedule, setContactToSchedule] = useState<ContactToSchedule | null>(null);

  useRegisterOrbitDock({
    leftItems: [
      { label: "Propostas", icon: <FileText />, onSelect: () => setOpenPanel("proposals"), isActive: openPanel === "proposals" },
      { label: "Lembrete", icon: <AlarmClock />, onSelect: () => setOpenPanel("reminder"), isActive: openPanel === "reminder" },
    ],
    rightItems: [
      { label: "Contatos", icon: <Users />, onSelect: () => setOpenPanel("contacts"), isActive: openPanel === "contacts" },
      { label: "Eventos", icon: <Sparkles />, onSelect: () => setOpenPanel("events"), isActive: openPanel === "events" },
    ],
    // Agendas no centro do arco, no lugar do ASTRO (mesmo padrão do "+ Bloco" no construtor de formulários).
    centerAction: { label: "Agendas", icon: <CalendarDays />, onSelect: () => setOpenPanel("agendas") },
  });

  const togglePanel = (panel: QuickMenuPanel) => (isOpen: boolean) => setOpenPanel(isOpen ? panel : null);

  return (
    <>
      <ProposalsSheet open={openPanel === "proposals"} onOpenChange={togglePanel("proposals")} appointments={appointments} />
      <ReminderSheet open={openPanel === "reminder"} onOpenChange={togglePanel("reminder")} appointments={appointments} />
      <AgendasSheet
        open={openPanel === "agendas"}
        onOpenChange={togglePanel("agendas")}
        agendas={agendas}
        bookingBaseUrl={bookingBaseUrl}
      />
      <ContactsSheet
        open={openPanel === "contacts"}
        onOpenChange={togglePanel("contacts")}
        appointments={appointments}
        onSchedule={(contact) => {
          setOpenPanel(null);
          setContactToSchedule(contact);
        }}
      />
      <EventsSheet open={openPanel === "events"} onOpenChange={togglePanel("events")} />
      {contactToSchedule && (
        <CreateAppointmentModal
          open
          onClose={() => setContactToSchedule(null)}
          initialName={contactToSchedule.name}
          initialPhone={contactToSchedule.phone ?? undefined}
        />
      )}
    </>
  );
}
