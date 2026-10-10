// Identificadores dos cliques do menu do cliente (spec 0089, RF-8). O passo e os dados vão no
// próprio id, então nada é guardado entre mensagens. Tudo o que vem aqui é conferido de novo
// no servidor a cada clique: o id é entrada de fora, não é confiável.

export const CLIENT_MENU_PREFIX = "cli:";

/** Marca "sem agendamento": o roteiro está marcando um horário novo, não remarcando. */
const NO_APPOINTMENT = "-";

export type ClientMenuStep =
  | { step: "menu" }
  | { step: "more" }
  | { step: "human" }
  | { step: "links" }
  | { step: "book" }
  | { step: "mine" }
  | { step: "days"; agendaId: string; appointmentId: string | null }
  | { step: "slots"; agendaId: string; date: string; appointmentId: string | null; page: number }
  | { step: "slot"; agendaId: string; date: string; time: string; appointmentId: string | null }
  | { step: "confirm"; agendaId: string; date: string; time: string; appointmentId: string | null }
  | { step: "appointment"; appointmentId: string }
  | { step: "reschedule"; appointmentId: string }
  | { step: "cancel"; appointmentId: string }
  | { step: "cancelConfirm"; appointmentId: string };

const SAFE_PART = /^[A-Za-z0-9_-]{1,40}$/;
const DATE_PART = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PART = /^\d{2}:\d{2}$/;

function appointmentPart(appointmentId: string | null): string {
  return appointmentId ?? NO_APPOINTMENT;
}

export function clientMenuId(target: ClientMenuStep): string {
  switch (target.step) {
    case "days":
      return `${CLIENT_MENU_PREFIX}days|${target.agendaId}|${appointmentPart(target.appointmentId)}`;
    case "slots":
      return `${CLIENT_MENU_PREFIX}slots|${target.agendaId}|${target.date}|${appointmentPart(target.appointmentId)}|${target.page}`;
    case "slot":
    case "confirm":
      return `${CLIENT_MENU_PREFIX}${target.step}|${target.agendaId}|${target.date}|${target.time}|${appointmentPart(target.appointmentId)}`;
    case "appointment":
    case "reschedule":
    case "cancel":
    case "cancelConfirm":
      return `${CLIENT_MENU_PREFIX}${target.step}|${target.appointmentId}`;
    default:
      return `${CLIENT_MENU_PREFIX}${target.step}`;
  }
}

export function isClientMenuId(replyId: string | null | undefined): replyId is string {
  return typeof replyId === "string" && replyId.startsWith(CLIENT_MENU_PREFIX);
}

/** Id malformado devolve `null`: quem chama trata como clique inválido, nunca como pedido novo. */
export function parseClientMenuId(replyId: string): ClientMenuStep | null {
  if (!isClientMenuId(replyId) || replyId.length > 200) return null;
  const [step, ...parts] = replyId.slice(CLIENT_MENU_PREFIX.length).split("|");
  const toAppointmentId = (part: string | undefined) => (part && part !== NO_APPOINTMENT ? part : null);
  const areSafe = (...values: (string | undefined)[]) => values.every((value) => value !== undefined && SAFE_PART.test(value));

  switch (step) {
    case "menu":
    case "more":
    case "human":
    case "links":
    case "book":
    case "mine":
      return parts.length === 0 ? { step } : null;
    case "days":
      return areSafe(parts[0], parts[1]) ? { step, agendaId: parts[0], appointmentId: toAppointmentId(parts[1]) } : null;
    case "slots": {
      const page = Number(parts[3]);
      if (!areSafe(parts[0], parts[2]) || !DATE_PART.test(parts[1] ?? "") || !Number.isInteger(page) || page < 0 || page > 20) return null;
      return { step, agendaId: parts[0], date: parts[1], appointmentId: toAppointmentId(parts[2]), page };
    }
    case "slot":
    case "confirm":
      if (!areSafe(parts[0], parts[3]) || !DATE_PART.test(parts[1] ?? "") || !TIME_PART.test(parts[2] ?? "")) return null;
      return { step, agendaId: parts[0], date: parts[1], time: parts[2], appointmentId: toAppointmentId(parts[3]) };
    case "appointment":
    case "reschedule":
    case "cancel":
    case "cancelConfirm":
      return areSafe(parts[0]) ? { step, appointmentId: parts[0] } : null;
    default:
      return null;
  }
}
