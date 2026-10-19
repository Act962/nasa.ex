"use client";

import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useAnswerAppointmentCheck } from "@/features/tracking-chat/hooks/use-appointment-check";

// Conferência do agendamento (spec 0113, RF-18): só a equipe vê; nada sai para o cliente.
export interface PendingAppointmentCheck {
  id: string;
  title: string | null;
  startsAt: string;
  askCount: number;
}

type CheckAnswer = "attended" | "not_yet" | "cancelled";

// Pelo resultado do servidor: o terceiro "Não" avisa o dono em vez de perguntar de novo.
const RESULT_TOAST: Record<string, string> = {
  attended: "Atendimento finalizado.",
  not_yet: "Perguntamos de novo em 10 minutos.",
  unanswered: "O dono foi avisado de que o cliente não chegou.",
  cancelled: "Marcado como cancelado. A recuperação começa pelos Gatilhos.",
  rescheduled: "Esse horário mudou. A conferência foi encerrada.",
  already_answered: "Alguém da equipe já respondeu.",
};

export function AppointmentCheckCard({ check }: { check: PendingAppointmentCheck }) {
  const answerCheck = useAnswerAppointmentCheck();
  const time = new Date(check.startsAt).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

  const answer = (choice: CheckAnswer) =>
    answerCheck.mutate(
      { checkId: check.id, answer: choice },
      {
        onSuccess: (result) => toast.success(RESULT_TOAST[result.status] ?? "Resposta salva."),
        onError: () => toast.error("Não foi possível salvar a resposta."),
      },
    );

  return (
    <div
      data-guide={GUIDE_ANCHORS.appointmentCheckCard.id}
      className="mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm"
    >
      <CalendarClock className="size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">Horário das {time}.</span> O cliente veio?
        {check.askCount > 1 && <span className="text-muted-foreground"> ({check.askCount}ª conferência)</span>}
        <span className="block text-xs text-muted-foreground">Só a equipe vê este aviso.</span>
      </p>
      <div className="flex gap-1.5">
        <Button size="sm" disabled={answerCheck.isPending} onClick={() => answer("attended")}>
          Sim
        </Button>
        <Button size="sm" variant="outline" disabled={answerCheck.isPending} onClick={() => answer("not_yet")}>
          Não
        </Button>
        <Button size="sm" variant="outline" disabled={answerCheck.isPending} onClick={() => answer("cancelled")}>
          Cancelou
        </Button>
      </div>
    </div>
  );
}
