import "server-only";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

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
  /** Última resposta da IA ao cliente nesta seção: junto com `lastHumanAt`, é o que conta como troca de verdade. */
  lastAiReplyAt?: string | null;
  complaintAt?: string | null;
  /** Espera que gerou a cadeia de avisos ao dono; aviso de outra espera não age. */
  noticeAnchorAt?: string | null;
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

/**
 * Grava só se os campos ainda têm o valor esperado (`null` = vazio). É a trava das checagens: duas que
 * acordam juntas, ou uma repetida pelo Inngest, não mandam a mesma mensagem duas vezes.
 */
export async function patchSectionIf(
  sectionId: string,
  patch: Partial<SectionState>,
  expected: Partial<Record<keyof SectionState, string | null>>,
): Promise<boolean> {
  const conditions = Object.entries(expected).map(([key, value]) =>
    value === null ? Prisma.sql`(metadata->>${key}) IS NULL` : Prisma.sql`metadata->>${key} = ${value}`,
  );
  const updatedRows = await prisma.$executeRaw`
    UPDATE lead_journey_events
    SET metadata = metadata || ${JSON.stringify(patch)}::jsonb
    WHERE id = ${sectionId} AND kind = 'attendance_section'
    ${conditions.length > 0 ? Prisma.sql`AND ${Prisma.join(conditions, " AND ")}` : Prisma.empty}
  `;
  return updatedRows > 0;
}

export async function closeSection(sectionId: string, outcome: SectionOutcome, now: Date = new Date()): Promise<void> {
  await patchSection(sectionId, { status: "closed", outcome, closedAt: now.toISOString() });
}

/**
 * Seção aberta do lead, abrindo uma nova quando não há ou quando a aberta está parada há mais de 24 h
 * (fecha como `EXPIRED`). Sem job agendado: a expiração é conferida quando chega a próxima mensagem. A trava
 * por lead evita duas seções abertas quando duas mensagens chegam juntas.
 */
export async function ensureOpenSection(
  leadId: string,
  reason: SectionOpenReason,
  now: Date = new Date(),
): Promise<{ section: AttendanceSection; isNew: boolean }> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance-section:${leadId}`}))::text AS locked`;
    const openEvent = await tx.leadJourneyEvent.findFirst({
      where: { leadId, kind: "attendance_section", metadata: { path: ["status"], equals: "open" } },
      orderBy: { occurredAt: "desc" },
      select: { id: true, leadId: true, metadata: true },
    });
    const nowIso = now.toISOString();
    if (openEvent) {
      const openSectionNow = toSection(openEvent);
      const idleMs = now.getTime() - new Date(openSectionNow.state.lastActivityAt).getTime();
      const patch: Partial<SectionState> =
        idleMs <= SECTION_IDLE_EXPIRY_MS
          ? { lastActivityAt: nowIso }
          : { status: "closed", outcome: "EXPIRED", closedAt: nowIso };
      await tx.$executeRaw`
        UPDATE lead_journey_events SET metadata = metadata || ${JSON.stringify(patch)}::jsonb WHERE id = ${openEvent.id}
      `;
      if (idleMs <= SECTION_IDLE_EXPIRY_MS) {
        return { section: { ...openSectionNow, state: { ...openSectionNow.state, lastActivityAt: nowIso } }, isNew: false };
      }
    }
    const state: SectionState = {
      status: "open",
      openedAt: nowIso,
      openReason: reason,
      lastActivityAt: nowIso,
      summaryCount: 0,
      ownerNoticeCount: 0,
    };
    const created = await tx.leadJourneyEvent.create({
      data: { leadId, kind: "attendance_section", occurredAt: now, metadata: state as object },
      select: { id: true, leadId: true, metadata: true },
    });
    return { section: toSection(created), isNew: true };
  });
}

/** Resumo mais recente do lead (seção aberta ou fechada), para os textos da IA nos fluxos. */
export async function findLatestSectionSummary(leadId: string): Promise<string | null> {
  const sections = await prisma.leadJourneyEvent.findMany({
    where: { leadId, kind: "attendance_section" },
    orderBy: { occurredAt: "desc" },
    take: 3,
    select: { metadata: true },
  });
  for (const section of sections) {
    const summary = (section.metadata as Partial<SectionState> | null)?.summary;
    if (typeof summary === "string" && summary.trim()) return summary.trim();
  }
  return null;
}
