/** Dados que o menu rápido do ASTRO na Agenda usa (vindos da lista de compromissos e de agendas). */

export interface QuickMenuAppointment {
  id: string;
  title: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
  status: string;
  agendaId: string;
  agenda?: { id: string; name: string } | null;
  lead?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
}

export interface QuickMenuAgenda {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  slotDuration: number;
  slug: string;
}

export type QuickMenuPanel = "proposals" | "reminder" | "agendas" | "contacts" | "events";
