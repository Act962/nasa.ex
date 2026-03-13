"use client";

import { useSuspenseAgenda } from "../hooks/use-agenda";
import { HeaderAgenda } from "./header";

interface EditorAgendaProps {
  agendaId: string;
}

export function EditorAgenda({ agendaId }: EditorAgendaProps) {
  const { data } = useSuspenseAgenda(agendaId);

  return (
    <div className="h-full w-full">
      <HeaderAgenda agendaId={agendaId} />
      <div className="h-full w-full px-5">{JSON.stringify(data)}</div>
    </div>
  );
}
