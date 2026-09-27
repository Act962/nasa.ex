import prisma from "../../../src/lib/prisma";
import { assertQaOrg } from "../qa-org";
import type { AstroReply } from "../astro-session";
import { expectThat, type QaCaseContext } from "./types";

/** Resposta do "usuário" por campo que o ASTRO pergunta (agendaName, leadName...). */
export type FieldAnswers = Record<string, string>;

export interface ConversationTurn {
  userText: string;
  reply: AstroReply;
  /** Compromissos novos no banco logo depois desta resposta. */
  appointmentsCreatedSoFar: number;
}

const FIELD_HINTS: { field: string; pattern: RegExp }[] = [
  { field: "agendaName", pattern: /agenda/i },
  { field: "leadName", pattern: /com quem|lead|cliente/i },
  { field: "startsAt", pattern: /hora|horario|quando|data/i },
  { field: "notifyPhone", pattern: /whats|numero/i },
];

/** Campo que a resposta está pedindo, pelo cartão ou pelo texto. */
export function askedField(reply: AstroReply): string | null {
  const result = reply.actionResult;
  if (result?.status === "ambiguous") return result.field;
  if (result?.status === "needs_input") return result.missingFields[0]?.key ?? null;
  const normalized = reply.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!/\?/.test(normalized)) return null;
  return FIELD_HINTS.find((hint) => hint.pattern.test(normalized))?.field ?? null;
}

/**
 * Conversa até o ASTRO concluir, errar ou parar de perguntar o que sabemos
 * responder. Registra depois de cada turno quantos compromissos já existem,
 * para o caso provar que nada foi gravado antes da hora.
 */
export async function converse(params: {
  context: QaCaseContext;
  firstMessage: string;
  answers: FieldAnswers;
  maxTurns?: number;
  /** `false` para parar no cartão sem confirmar. */
  shouldConfirm?: boolean;
}): Promise<ConversationTurn[]> {
  const turns: ConversationTurn[] = [];
  let userText: string | null = params.firstMessage;
  const answeredFields = new Set<string>();

  for (let turn = 0; userText && turn < (params.maxTurns ?? 7); turn++) {
    const reply = await params.context.session.send(userText);
    turns.push({
      userText,
      reply,
      appointmentsCreatedSoFar: await countCreatedAppointments(params.context),
    });

    // Cartão de confirmação: o "usuário" confirma, como clicaria no widget.
    if (reply.isConfirmationCard && reply.pendingActionId && params.shouldConfirm !== false) {
      userText = `confirmar ${reply.pendingActionId}`;
      continue;
    }

    const field = askedField(reply);
    const status = reply.actionResult?.status;
    if (status === "done" || status === "error" || reply.isConfirmationCard || !field) break;
    if (!(field in params.answers) || answeredFields.has(field)) break;
    answeredFields.add(field);
    userText = params.answers[field];
  }
  return turns;
}

export function allReplyText(turns: ConversationTurn[]): string {
  return turns.map((turn) => turn.reply.text).join("\n");
}

export async function countCreatedAppointments(context: QaCaseContext): Promise<number> {
  return prisma.appointment.count({
    where: {
      agenda: { organizationId: context.qaOrg.organizationId },
      createdAt: { gte: context.startedAt },
    },
  });
}

export async function findCreatedAppointments(context: QaCaseContext) {
  return prisma.appointment.findMany({
    where: {
      agenda: { organizationId: context.qaOrg.organizationId },
      createdAt: { gte: context.startedAt },
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      leadId: true,
      agenda: { select: { name: true } },
      lead: { select: { name: true } },
    },
  });
}

export async function findCreatedReminders(context: QaCaseContext) {
  return prisma.reminder.findMany({
    where: {
      tracking: { organizationId: context.qaOrg.organizationId },
      createdAt: { gte: context.startedAt },
    },
    select: { id: true, notifyPhone: true, nextRemindAt: true },
  });
}

/** Contagem dos registros que um caso só de leitura não pode mudar. */
export async function snapshotQaCounts(context: QaCaseContext) {
  const organizationId = context.qaOrg.organizationId;
  const [leads, appointments, reminders, trackings, tags] = await Promise.all([
    prisma.lead.count({ where: { tracking: { organizationId } } }),
    prisma.appointment.count({ where: { agenda: { organizationId } } }),
    prisma.reminder.count({ where: { tracking: { organizationId } } }),
    prisma.tracking.count({ where: { organizationId } }),
    prisma.tag.count({ where: { organizationId } }),
  ]);
  return { leads, appointments, reminders, trackings, tags };
}

/** Limpeza padrão: apaga o que nasceu na org de QA depois que o caso começou. */
export async function removeCreatedSince(context: QaCaseContext): Promise<void> {
  const organizationId = context.qaOrg.organizationId;
  await assertQaOrg(organizationId);
  const createdSince = { gte: context.startedAt };
  await prisma.leadHistory.deleteMany({ where: { lead: { tracking: { organizationId } }, createdAt: createdSince } });
  await prisma.appointment.deleteMany({ where: { agenda: { organizationId }, createdAt: createdSince } });
  await prisma.reminder.deleteMany({ where: { tracking: { organizationId }, createdAt: createdSince } });
  await prisma.leadTag.deleteMany({ where: { lead: { tracking: { organizationId }, createdAt: createdSince } } });
  await prisma.lead.deleteMany({ where: { tracking: { organizationId }, createdAt: createdSince } });
  await prisma.agenda.deleteMany({ where: { organizationId, createdAt: createdSince } });
  await prisma.tag.deleteMany({ where: { organizationId, createdAt: createdSince } });
  await prisma.action.deleteMany({ where: { workspace: { organizationId }, createdAt: createdSince } });
  await prisma.workspace.deleteMany({ where: { organizationId, createdAt: createdSince } });
}

const WEEKDAY_NAMES = /\b(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)/i;

export function mentionsWeekday(text: string): boolean {
  return WEEKDAY_NAMES.test(text);
}

/** Pergunta sem seletor obriga o usuário a digitar — é falha (spec 0033, RF-9). */
export function expectQuestionsHavePicker(turns: ConversationTurn[]): void {
  const questionsWithoutPicker = turns.filter((turn) => {
    const result = turn.reply.actionResult;
    const isQuestion = result?.status === "needs_input" || result?.status === "ambiguous";
    return isQuestion && turn.reply.layer !== "escolha" && !result.picker;
  });
  expectThat(
    questionsWithoutPicker.length === 0,
    `Pergunta sem seletor: ${questionsWithoutPicker.map((turn) => turn.reply.text.slice(0, 80)).join(" | ")}`,
  );
}

/** Nenhum turno do roteiro pode cair no orquestrador (custo ~23 mil tokens). */
export function expectNoOrchestrator(turns: ConversationTurn[]): void {
  const orchestratorTurn = turns.find((turn) => turn.reply.layer === "orquestrador");
  expectThat(
    !orchestratorTurn,
    `Caiu no orquestrador em "${orchestratorTurn?.userText}": ${orchestratorTurn?.reply.text.slice(0, 200)}`,
  );
}

const LEAD_SNAPSHOT_FIELDS = {
  id: true,
  name: true,
  phone: true,
  email: true,
  statusId: true,
  temperature: true,
  amount: true,
  description: true,
} as const;

type LeadSnapshot = NonNullable<Awaited<ReturnType<typeof findSeedLead>>>;

const leadSnapshots = new WeakMap<QaCaseContext, LeadSnapshot>();

export async function findSeedLead(context: QaCaseContext, name: string) {
  return prisma.lead.findFirst({
    where: { tracking: { organizationId: context.qaOrg.organizationId }, name },
    select: LEAD_SNAPSHOT_FIELDS,
  });
}

/** Guarda o lead da massa antes de o caso mexer nele. */
export async function snapshotSeedLead(context: QaCaseContext, name: string): Promise<LeadSnapshot> {
  const lead = await findSeedLead(context, name);
  expectThat(lead, `Lead da massa "${name}" não existe.`);
  leadSnapshots.set(context, lead);
  return lead;
}

/** Limpeza de caso que altera lead da massa: volta ao que era e apaga o criado. */
export async function restoreSeedLead(context: QaCaseContext): Promise<void> {
  const snapshot = leadSnapshots.get(context);
  if (snapshot) {
    const { id, ...fields } = snapshot;
    await prisma.lead.update({ where: { id }, data: fields });
  }
  await prisma.leadHistory.deleteMany({
    where: { lead: { tracking: { organizationId: context.qaOrg.organizationId } }, createdAt: { gte: context.startedAt } },
  });
  await removeCreatedSince(context);
}
