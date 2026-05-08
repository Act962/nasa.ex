import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import prismaDefault from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

// Mantemos o tipo local ate o dev rodar `prisma generate` apos a migration
// (que adiciona o enum LeadEventType ao client gerado). Quando isso acontecer
// basta trocar este alias por: `import type { LeadEventType } from "@/generated/prisma/client";`
export type LeadEventType =
  | "ACTION_CHANGE"
  | "STATUS_CHANGE"
  | "TRACKING_CHANGE"
  | "RESPONSIBLE_CHANGE"
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

function buildData(i: RecordLeadEventInput) {
  return {
    leadId: i.leadId,
    action: (i.action ?? "ACTIVE") as LeadActionLocal,
    eventType: i.eventType,
    userId: i.userId ?? null,
    previousStatusId: i.previousStatusId ?? null,
    newStatusId: i.newStatusId ?? null,
    previousTrackingId: i.previousTrackingId ?? null,
    newTrackingId: i.newTrackingId ?? null,
    previousResponsibleId: i.previousResponsibleId ?? null,
    newResponsibleId: i.newResponsibleId ?? null,
    notes: i.notes ?? null,
    metadata:
      i.metadata !== undefined && i.metadata !== null
        ? (i.metadata as Prisma.InputJsonValue)
        : undefined,
  };
}

const PUBLIC_TIMELINE_EVENTS: ReadonlySet<LeadEventType> = new Set<LeadEventType>([
  "STATUS_CHANGE",
  "TRACKING_CHANGE",
  "RESPONSIBLE_CHANGE",
  "FORM_SUBMITTED",
  "FILE_UPLOADED",
  "SLA_BREACHED",
]);

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

export async function recordLeadEvent(
  input: RecordLeadEventInput,
  client: PrismaLike = prismaDefault,
) {
  // Cast para `any` intencional: campos novos do schema (eventType, previous*, etc.)
  // só existem no client após `prisma generate` rodar pós-migration.
  const created = await (client.leadHistory as unknown as {
    create: (args: { data: unknown }) => Promise<unknown>;
  }).create({
    data: buildData(input),
  });
  await notifyPublicChannel(input.leadId, input.eventType, client);
  return created;
}

export async function recordLeadEvents(
  inputs: RecordLeadEventInput[],
  client: PrismaLike = prismaDefault,
) {
  if (inputs.length === 0) return;
  await (client.leadHistory as unknown as {
    createMany: (args: { data: unknown[] }) => Promise<unknown>;
  }).createMany({
    data: inputs.map(buildData),
  });
}
