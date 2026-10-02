"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { authClient } from "@/lib/auth-client";
import { useCreateForgeProposal } from "@/features/forge/hooks/use-forge";
import { ProposalForm } from "@/features/forge/components/proposals/proposal-form";
import { QuickMenuEmpty, QuickMenuSheet } from "./quick-menu-sheet";
import { formatAppointmentWhen, upcomingAppointmentsWithLead } from "./upcoming-appointments";
import type { QuickMenuAppointment } from "./quick-menu-types";

/** Propostas: gera no Forge uma proposta já ligada ao lead de um compromisso e abre para revisar. */
export function ProposalsSheet({
  open,
  onOpenChange,
  appointments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: QuickMenuAppointment[];
}) {
  const { data: session } = authClient.useSession();
  const createProposal = useCreateForgeProposal();
  const [creatingAppointmentId, setCreatingAppointmentId] = useState<string | null>(null);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const upcomingAppointments = upcomingAppointmentsWithLead(appointments);

  const generateProposal = (appointment: QuickMenuAppointment) => {
    if (!appointment.lead || !session?.user.id) return;
    setCreatingAppointmentId(appointment.id);
    createProposal.mutate(
      {
        title: `Proposta — ${appointment.lead.name}`,
        clientId: appointment.lead.id,
        responsibleId: session.user.id,
        participants: [],
        products: [],
        description: appointment.agenda?.name ? `Após ${appointment.agenda.name} (${formatAppointmentWhen(appointment)})` : undefined,
      },
      {
        onSuccess: ({ proposal }) => {
          toast.success("Proposta criada! Revise e envie ao cliente.");
          onOpenChange(false);
          setEditingProposalId(proposal.id);
        },
        onError: () => toast.error("Não consegui criar a proposta agora."),
        onSettled: () => setCreatingAppointmentId(null),
      },
    );
  };

  return (
    <>
      <QuickMenuSheet
        open={open}
        onOpenChange={onOpenChange}
        icon={<FileText className="text-warning" />}
        title="Propostas"
        description="Gere a proposta do Forge para o cliente de um compromisso, já com os dados dele."
      >
        {upcomingAppointments.length === 0 ? (
          <QuickMenuEmpty>Nenhum compromisso com cliente pela frente.</QuickMenuEmpty>
        ) : (
          <ul className="divide-y divide-line">
            {upcomingAppointments.map((appointment) => (
              <li key={appointment.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warning/15 text-xs font-bold text-warning">
                  {appointment.lead?.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{appointment.lead?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatAppointmentWhen(appointment)} · {appointment.agenda?.name ?? "Agenda"}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 rounded-full"
                  disabled={creatingAppointmentId !== null}
                  onClick={() => generateProposal(appointment)}
                >
                  {creatingAppointmentId === appointment.id ? <OrbitaSpinner className="size-4" isOnBrandColor /> : "Gerar proposta"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </QuickMenuSheet>
      {editingProposalId && (
        <ProposalForm open proposalId={editingProposalId} onClose={() => setEditingProposalId(null)} />
      )}
    </>
  );
}
