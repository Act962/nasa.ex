"use client";

import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useContacts } from "@/features/campanhas/hooks/use-contacts";
import { QuickMenuEmpty, QuickMenuSheet } from "./quick-menu-sheet";
import type { QuickMenuAppointment } from "./quick-menu-types";
import { formatAppointmentWhen, upcomingAppointmentsWithLead } from "./upcoming-appointments";

/** Contatos: busca na base e agenda com o contato escolhido em dois toques. */

const SEARCH_DEBOUNCE_MS = 300;
const CONTACTS_PAGE_SIZE = 25;

export interface ContactToSchedule {
  name: string;
  phone: string | null;
}

export function ContactsSheet({
  open,
  onOpenChange,
  appointments,
  onSchedule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: QuickMenuAppointment[];
  onSchedule: (contact: ContactToSchedule) => void;
}) {
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useContacts({ search: search || undefined }, 0, CONTACTS_PAGE_SIZE);

  useEffect(() => {
    const debounceTimer = setTimeout(() => setSearch(searchDraft.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceTimer);
  }, [searchDraft]);

  const nextAppointmentByLeadId = new Map(
    upcomingAppointmentsWithLead(appointments, 200).map((appointment) => [appointment.lead?.id ?? "", appointment]),
  );
  const contacts = data?.contacts ?? [];

  return (
    <QuickMenuSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={<Users className="text-info" />}
      title="Contatos"
      description="Busque um contato e agende com ele."
    >
      <label className="sticky top-0 z-10 mb-2 flex h-11 items-center gap-2 rounded-full border border-line bg-card px-4">
        <Search className="size-4 text-muted-foreground" />
        <Input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
      </label>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <OrbitaSpinner className="size-6" />
        </div>
      ) : contacts.length === 0 ? (
        <QuickMenuEmpty>{search ? "Nenhum contato com esse nome." : "Nenhum contato na base ainda."}</QuickMenuEmpty>
      ) : (
        <ul className="divide-y divide-line">
          {contacts.map((contact) => {
            const nextAppointment = nextAppointmentByLeadId.get(contact.id);
            return (
              <li key={contact.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-info/15 text-xs font-bold text-info">
                  {contact.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{contact.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {nextAppointment ? `Já agendado · ${formatAppointmentWhen(nextAppointment)}` : (contact.phone ?? "Sem telefone")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSchedule({ name: contact.name, phone: contact.phone })}
                  className="h-9 shrink-0 rounded-full bg-foreground px-4 text-sm font-semibold text-background"
                >
                  Agendar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </QuickMenuSheet>
  );
}
