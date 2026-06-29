import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import prismaDefault from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import {
  trackLeadEvent,
  type LeadJourneyEventKind,
} from "@/lib/lead-journey/track";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Tipos de evento usados pela feature de Formulários/SLA/Link Público.
 * Mapeados pra `LeadJourneyEventKind` do sistema unificado de jornada do
 * upstream — single source of truth é `LeadJourneyEvent` (via `trackLeadEvent`).
 *
 * Eventos sem equivalente direto (TAG_REMOVED, FILE_UPLOADED, NOTE,
 * PUBLIC_LINK_VIEWED, SLA_BREACHED, ACTION_CHANGE) são silenciosamente
 * ignorados pelo journey, mas o Pusher do link público continua disparando
 * pra atualizar a tela do cliente em tempo real.
 */
export type LeadEventType =
  | "ACTION_CHANGE"
  | "STATUS_CHANGE"
  | "TRACKING_CHANGE"
  | "RESPONSIBLE_CHANGE"
  | "FORM_STARTED"
  | "FORM_SUBMITTED"
  | "TAG_ADDED"
  | "TAG_REMOVED"
  | "FILE_UPLOADED"
  | "NOTE"
  | "PUBLIC_LINK_VIEWED"
  | "SLA_BREACHED";

export type LeadActionLocal = "ACTIVE" | "DELETED" | "WON" | "LOST";

export type RecordLeadEventInput = {
  leadId: string;
  eventType: LeadEventType;
  userId?: string | null;
  action?: LeadActionLocal;
  previousStatusId?: string | null;
  newStatusId?: string | null;
  previousTrackingId?: string | null;
  newTrackingId?: string | null;
  previousResponsibleId?: string | null;
  newResponsibleId?: string | null;
  notes?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

const TYPE_TO_KIND: Partial<Record<LeadEventType, LeadJourneyEventKind>> = {
  STATUS_CHANGE: "status_changed",
  TRACKING_CHANGE: "status_changed",
  RESPONSIBLE_CHANGE: "lead_assigned",
  // FORM_STARTED e FORM_SUBMITTED dividem o mesmo `kind` no banco
  // (LeadJourneyEvent.kind = "form_submit"); o front diferencia pelo
  // `metadata.started` (true → ícone/label diferente). Mantém o schema
  // unificado e evita migration nova só pra um literal.
  FORM_STARTED: "form_submit",
  FORM_SUBMITTED: "form_submit",
  TAG_ADDED: "tag_added",
  // TAG_REMOVED agora também vai pro journey — antes era silenciosamente
  // ignorado (bug histórico). Necessário pra Jornada do lead mostrar
  // operações de remoção, incluindo as feitas via automation.
  TAG_REMOVED: "tag_removed",
};

const PUBLIC_TIMELINE_EVENTS: ReadonlySet<LeadEventType> = new Set<LeadEventType>([
  "STATUS_CHANGE",
  "TRACKING_CHANGE",
  "RESPONSIBLE_CHANGE",
  "FORM_STARTED",
  "FORM_SUBMITTED",
  "FILE_UPLOADED",
  "SLA_BREACHED",
]);

function buildJourneyMetadata(i: RecordLeadEventInput): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    eventType: i.eventType,
  };
  if (i.previousStatusId) metadata.previousStatusId = i.previousStatusId;
  if (i.newStatusId) metadata.newStatusId = i.newStatusId;
  if (i.previousTrackingId) metadata.previousTrackingId = i.previousTrackingId;
  if (i.newTrackingId) metadata.newTrackingId = i.newTrackingId;
  if (i.previousResponsibleId) metadata.previousResponsibleId = i.previousResponsibleId;
  if (i.newResponsibleId) metadata.newResponsibleId = i.newResponsibleId;
  if (i.notes) metadata.notes = i.notes;
  if (i.metadata && typeof i.metadata === "object") {
    Object.assign(metadata, i.metadata as Record<string, unknown>);
  }
  return metadata;
}

async function notifyPublicChannel(
  leadId: string,
  eventType: LeadEventType,
  client: PrismaLike,
) {
  if (!PUBLIC_TIMELINE_EVENTS.has(eventType)) return;
  try {
    const lead = await (
      client.lead.findUnique as (args: unknown) => Promise<unknown>
    )({
      where: { id: leadId },
      select: { publicToken: true },
    });
    const token = (lead as unknown as { publicToken?: string | null } | null)
      ?.publicToken;
    if (!token) return;
    await pusherServer.trigger(`lead-public-${token}`, "update", {
      eventType,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[recordLeadEvent] pusher notify failed", e);
  }
}

/**
 * Canal interno do lead — usado por "Detalhes do lead" (consultor logado)
 * pra atualizar Jornada/Tags/Status em tempo real. Dispara SEMPRE (não
 * depende de publicToken nem do tipo de evento). Quem assina:
 * `lead-details.tsx` e quaisquer outras telas internas que mostram o lead.
 *
 * Diferente do canal público que filtra por `PUBLIC_TIMELINE_EVENTS`:
 * aqui tudo dispara — admin/consultor quer ver tudo. Inclui tag_added,
 * tag_removed e mudanças de campo que o público não vê.
 */
export async function notifyInternalLeadChannel(
  leadId: string,
  eventType: string = "lead_updated",
) {
  try {
    await pusherServer.trigger(`lead-internal-${leadId}`, "update", {
      eventType,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[notifyInternalLeadChannel] pusher notify failed", e);
  }
}

/**
 * Grava o evento na timeline unificada do lead (`LeadJourneyEvent` via
 * `trackLeadEvent`) e dispara Pusher pro canal público do lead, se ele tiver
 * `publicToken`. Eventos sem mapeamento pra `LeadJourneyEventKind` só
 * disparam Pusher (sem persistência adicional) — não criamos registro
 * paralelo em `LeadHistory` pra evitar duplicação com o sistema do upstream.
 */
export async function recordLeadEvent(
  input: RecordLeadEventInput,
  client: PrismaLike = prismaDefault,
) {
  const kind = TYPE_TO_KIND[input.eventType];
  let result: unknown = null;
  if (kind) {
    result = await trackLeadEvent({
      leadId: input.leadId,
      kind,
      actorId: input.userId ?? null,
      metadata: buildJourneyMetadata(input),
    });
  }
  await notifyPublicChannel(input.leadId, input.eventType, client);
  // Canal interno sempre — atualiza "Detalhes do lead" em tempo real.
  await notifyInternalLeadChannel(input.leadId, input.eventType);
  return result;
}

export async function recordLeadEvents(
  inputs: RecordLeadEventInput[],
  client: PrismaLike = prismaDefault,
) {
  for (const input of inputs) {
    await recordLeadEvent(input, client);
  }
}
