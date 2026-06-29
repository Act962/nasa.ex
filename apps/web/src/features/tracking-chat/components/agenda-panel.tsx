"use client";

import { CalendarIcon, XIcon } from "lucide-react";
import dynamic from "next/dynamic";

// react-big-calendar (+ addon DnD + 3 folhas de CSS) é pesado e só é usado neste
// painel, que abre sob demanda. Lazy com ssr:false tira do grafo até abrir.
const AllAppointmentsCalendar = dynamic(
  () =>
    import("@/features/agenda/components/all-appointments-calendar").then((m) => ({
      default: m.AllAppointmentsCalendar,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

// ─── Main Component ──────────────────────────────────────────────────────────

interface AgendaPanelProps {
  onClose: () => void;
  onInsertLink?: (text: string) => void;
  lead?: {
    id: string;
    name: string;
    phone: string | null;
    email?: string | null;
  };
}

export function AgendaPanel({ onClose, onInsertLink, lead }: AgendaPanelProps) {
  const handleAppointmentCreated = (appointmentId: string) => {
    const link = `${window.location.origin}/agenda/appointment/${appointmentId}`;
    const text = `🗓️ Seu compromisso foi confirmado! Acompanhe, cancele ou reagende pelo link:\n${link}`;
    onInsertLink?.(text);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      <div
        className="
          fixed z-50
          w-[90vw] h-[85vh]
          lg:w-[70vw] lg:h-[80vh]
          bg-background border border-border shadow-2xl flex flex-col overflow-hidden
          bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl
          lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-2xl
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Todos os agendamentos</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Calendário — passa dados do lead para pré-preencher o modal de novo compromisso */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <AllAppointmentsCalendar
            leadName={lead?.name}
            leadPhone={lead?.phone ?? undefined}
            leadEmail={lead?.email ?? undefined}
            onAppointmentCreated={lead ? handleAppointmentCreated : undefined}
          />
        </div>
      </div>
    </>
  );
}
