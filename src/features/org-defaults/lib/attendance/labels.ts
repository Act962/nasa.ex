// Rótulos do atendimento usados no navegador (Jornada e Insights). Sem `server-only` de propósito.

export const ATTENDANCE_SCORE_REASON_LABEL: Record<string, string> = {
  replied_in_time: "Resposta no tempo",
  unanswered_beyond_time: "Cliente sem resposta",
  client_complained: "Cliente reclamou da demora",
  human_answered_waiting_client: "Atendente respondeu quem esperava",
  commitment_fulfilled: "Compromisso cumprido",
  no_show: "Não compareceu",
};

export const SECTION_OUTCOME_LABEL: Record<string, string> = {
  FINISHED: "Finalizado",
  CANCELLED: "Cancelou",
  WON: "Venda fechada",
  EXPIRED: "Encerrado sem conversa por 24 h",
};

export const APPOINTMENT_CHECK_ANSWER_LABEL: Record<string, string> = {
  pending: "Aguardando a equipe",
  not_yet: "Cliente ainda não chegou",
  attended: "Cliente veio",
  cancelled: "Cliente cancelou ou não veio",
  unanswered: "Sem confirmação da equipe",
  rescheduled: "Horário remarcado",
};

/** Mensagens fixas do atendimento (sem IA): não contam como fala da empresa e abrem a configuração no chat. */
export const ATTENDANCE_FIXED_MESSAGE_KINDS = ["attendance_holding", "attendance_handoff"] as const;
