import "server-only";
import prisma from "@/lib/prisma";

// Seção de atendimento (spec 0113, RF-13): uma oportunidade da conversa, guardada como evento
// `attendance_section` da Jornada. O metadata é o estado da seção e só muda por `patchSection`, que faz o
// merge no próprio banco (um UPDATE), para duas mensagens ao mesmo tempo não apagarem o campo uma da outra.

export const SECTION_IDLE_EXPIRY_MS = 24 * 60 * 60_000;

export type SectionOpenReason = "client_message" | "company_reopened" | "recovery";
export type SectionOutcome = "FINISHED" | "CANCELLED" | "WON" | "EXPIRED";

export interface SectionState {
  status: "open" | "closed";
  openedAt: string;
  openReason: SectionOpenReason;
  lastActivityAt: string;
  closedAt?: string;
  outcome?: SectionOutcome;
  purpose?: string;
  summary?: string;
  summaryUpToMessageId?: string;
  summaryUpdatedAt?: string;
  summaryCount?: number;
  /** Mensagem do cliente esperando resposta da empresa (id interno de `Message`). */
  awaitingMessageId?: string | null;
  awaitingSince?: string | null;
  holdingSentAt?: string | null;
  aiStepInAt?: string | null;
  humanRequestedAt?: string | null;
  ownerNoticeCount?: number;
  lastHumanAt?: string | null;
  complaintAt?: string | null;
}

export interface AttendanceSection {
  id: string;
  leadId: string;
  state: SectionState;
}

function toSection(event: { id: string; leadId: string; metadata: unknown }): AttendanceSection {
  return { id: event.id, leadId: event.leadId, state: event.metadata as SectionState };
}

export async function findOpenSection(leadId: string): Promise<AttendanceSection | null> {
  const event = await prisma.leadJourneyEvent.findFirst({
    where: { leadId, kind: "attendance_section", metadata: { path: ["status"], equals: "open" } },
    orderBy: { occurredAt: "desc" },
    select: { id: true, leadId: true, metadata: true },
  });
  return event ? toSection(event) : null;
}

/** Seções já fechadas, mais recentes primeiro (contexto da IA e recuperação). */
export async function listClosedSections(leadId: string, take: number): Promise<AttendanceSection[]> {
  const events = await prisma.leadJourneyEvent.findMany({
    where: { leadId, kind: "attendance_section", metadata: { path: ["status"], equals: "closed" } },
    orderBy: { occurredAt: "desc" },
    take,
    select: { id: true, leadId: true, metadata: true },
  });
  return events.map(toSection);
}

export async function patchSection(sectionId: string, patch: Partial<SectionState>): Promise<void> {
  await prisma.$executeRaw`
    UPDATE lead_journey_events
    SET metadata = metadata || ${JSON.stringify(patch)}::jsonb
    WHERE id = ${sectionId}
  `;
}

async function openSection(leadId: string, reason: SectionOpenReason, now: Date): Promise<AttendanceSection> {
  const state: SectionState = {
    status: "open",
    openedAt: now.toISOString(),
    openReason: reason,
    lastActivityAt: now.toISOString(),
    summaryCount: 0,
    ownerNoticeCount: 0,
  };
  const event = await prisma.leadJourneyEvent.create({
    data: { leadId, kind: "attendance_section", occurredAt: now, metadata: state as object },
    select: { id: true, leadId: true, metadata: true },
  });
  return toSection(event);
}

export async function closeSection(sectionId: string, outcome: SectionOutcome, now: Date = new Date()): Promise<void> {
  await patchSection(sectionId, { status: "closed", outcome, closedAt: now.toISOString() });
}

/**
 * Seção aberta do lead, abrindo uma nova quando não há ou quando a aberta está parada há mais de 24 h
 * (fecha como `EXPIRED`). Sem job agendado: a expiração é conferida quando chega a próxima mensagem.
 */
export async function ensureOpenSection(leadId: string, reason: SectionOpenReason, now: Date = new Date()): Promise<AttendanceSection> {
  const openSectionNow = await findOpenSection(leadId);
  if (openSectionNow) {
    const idleMs = now.getTime() - new Date(openSectionNow.state.lastActivityAt).getTime();
    if (idleMs <= SECTION_IDLE_EXPIRY_MS) {
      await patchSection(openSectionNow.id, { lastActivityAt: now.toISOString() });
      return { ...openSectionNow, state: { ...openSectionNow.state, lastActivityAt: now.toISOString() } };
    }
    await closeSection(openSectionNow.id, "EXPIRED", now);
  }
  return openSection(leadId, reason, now);
}
