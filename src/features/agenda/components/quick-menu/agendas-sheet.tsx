"use client";

import Link from "next/link";
import { CalendarDays, Copy, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useToggleActiveAgenda } from "@/features/agenda/hooks/use-agenda";
import { QuickMenuEmpty, QuickMenuSheet } from "./quick-menu-sheet";
import type { QuickMenuAgenda } from "./quick-menu-types";

/** Agendas: todas as agendas com liga/desliga, link de agendamento e atalho para configurar. */
export function AgendasSheet({
  open,
  onOpenChange,
  agendas,
  bookingBaseUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendas: QuickMenuAgenda[];
  bookingBaseUrl: string;
}) {
  const toggleActiveAgenda = useToggleActiveAgenda();

  const copyBookingLink = (agenda: QuickMenuAgenda) => {
    navigator.clipboard
      .writeText(`${bookingBaseUrl}/${agenda.slug}`)
      .then(() => toast.success("Link de agendamento copiado!"))
      .catch(() => toast.info(`${bookingBaseUrl}/${agenda.slug}`));
  };

  return (
    <QuickMenuSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={<CalendarDays className="text-info" />}
      title="Agendas"
      description="Ligue ou desligue, copie o link de agendamento e configure cada agenda."
    >
      {agendas.length === 0 ? (
        <QuickMenuEmpty>Você ainda não tem agendas.</QuickMenuEmpty>
      ) : (
        <ul className="space-y-2">
          {agendas.map((agenda) => (
            <li key={agenda.id} className="flex items-center gap-3 rounded-[18px] border border-line bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{agenda.name}</p>
                <p className="text-xs text-muted-foreground">
                  {agenda.isActive ? "Recebendo agendamentos" : "Desligada"} · {agenda.slotDuration} min
                </p>
              </div>
              <button
                type="button"
                aria-label={`Copiar link de ${agenda.name}`}
                onClick={() => copyBookingLink(agenda)}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
              >
                <Copy className="size-4" />
              </button>
              <Link
                href={`/agendas/${agenda.id}`}
                aria-label={`Configurar ${agenda.name}`}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
              >
                <Settings2 className="size-4" />
              </Link>
              <Switch
                checked={agenda.isActive}
                disabled={toggleActiveAgenda.isPending}
                onCheckedChange={(isActive) => toggleActiveAgenda.mutate({ agendaId: agenda.id, isActive })}
              />
            </li>
          ))}
        </ul>
      )}
    </QuickMenuSheet>
  );
}
