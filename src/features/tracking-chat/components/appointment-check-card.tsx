"use client";

import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAnswerAppointmentCheck } from "@/features/tracking-chat/hooks/use-appointment-check";

// Conferência do agendamento (spec 0113, RF-18): só a equipe vê; nada sai para o cliente.
export interface PendingAppointmentCheck {
  id: string;
  title: string | null;
  startsAt: string;
  askCount: number;
}

type CheckAnswer = "attended" | "not_yet" | "cancelled";

const ANSWER_TOAST: Record<CheckAnswer, string> = {
  attended: "Atendimento finalizado.",
  not_yet: "Perguntamos de novo em 10 minutos.",
  cancelled: "Marcado como cancelado. A recuperação começa pelos Gatilhos.",
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
        onSuccess: (result) =>
          toast.success(result.status === "already_answered" ? "Alguém da equipe já respondeu." : ANSWER_TOAST[choice]),
        onError: () => toast.error("Não foi possível salvar a resposta."),
      },
    );

  return (
    <div className="mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/5 px-3 py-2 text-sm">
      <CalendarClock className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
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
