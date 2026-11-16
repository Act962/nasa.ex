import "server-only";
import { ORPCError } from "@orpc/server";
import { Decimal } from "@prisma/client/runtime/client";
import prisma from "@/lib/prisma";
import { LeadAction } from "@/generated/prisma/enums";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { eventBus } from "@/features/alerts/lib/event-bus";
import { isAttendanceStateEnabled } from "@/features/org-defaults/lib/attendance/flag";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { getLastLeadMessage } from "@/features/tracking-executions/lib/lead-message";
import { findLeadTaggedMatchingWorkflows } from "@/features/triggers/components/lead-tagged/find-matching-workflows";
import { recordLeadHistory } from "@/app/router/leads/utils/history";
import { broadcastAgentWorkflowEvent, dispatchLeadTagged, dispatchMoveLeadStatus } from "@/inngest/utils";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { trackingToLeadData, type TrackingParams } from "@/lib/tracking/tracking-params";
import { recordLeadEvent, notifyInternalLeadChannel, type RecordLeadEventInput } from "../lib/history";
import { recordLeadOriginFromLead } from "../lib/lead-origin/record-lead-origin";
import { publishLeadChanged } from "../realtime/publish";
import { computeSlaDeadline } from "../lib/sla";

// Escritas de lead usadas pela tela (rotas oRPC) e pelo MCP (spec 0145, D-1): mesmos efeitos nos dois caminhos.

export interface LeadActor {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

/** `via` é o nome da IA externa: entra no histórico do lead e no de atividades (spec 0145, RF-5). */
interface ActorContext {
  actor: LeadActor;
  via?: string;
}

const withVia = (label: string, via?: string) => (via ? `${label} (via ${via})` : label);
const viaMetadata = (via?: string) => (via ? { via } : {});

export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string;
  description?: string;
  statusId: string;
  trackingId: string;
  tracking?: TrackingParams;
}

export async function createLeadRecord({ actor, via, input }: ActorContext & { input: CreateLeadInput }) {
  let isNewLead = false;
  const lead = await prisma.$transaction(async (tx) => {
    const existingLead = await tx.lead.findUnique({
      where: { phone_trackingId: { phone: input.phone, trackingId: input.trackingId } },
    });
    if (existingLead) return existingLead;

    const lastLead = await tx.lead.findFirst({
      where: { statusId: input.statusId, trackingId: input.trackingId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const order = lastLead ? new Decimal(lastLead.order).plus(1) : new Decimal(0);

    const newLead = await tx.lead.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        description: input.description,
        statusId: input.statusId,
        trackingId: input.trackingId,
        order,
        responsibleId: actor.id,
        assignedAt: new Date(),
        ...trackingToLeadData(input.tracking),
      },
      select: { id: true, name: true, phone: true, email: true, description: true, statusId: true, trackingId: true, createdAt: true },
    });

    await recordLeadHistory({ leadId: newLead.id, userId: actor.id, action: LeadAction.ACTIVE, notes: withVia("Lead criado", via), tx });
    isNewLead = true;
    return newLead;
  });

  // Telefone repetido devolve o lead que já existia: não houve criação, então nada de histórico nem Stars.
  if (!isNewLead) return { lead: toCreatedLead(lead), isNewLead };

  // Origem real do lead (spec 0114): cadastrado à mão no funil.
  await recordLeadOriginFromLead(lead.id, { origin: "MANUAL" });

  await trackLeadEvent({
    leadId: lead.id,
    kind: "lead_assigned",
    actorId: actor.id,
    metadata: { responsibleId: actor.id, source: via ? "external_ai" : "manual" },
  });

  const tracking = await prisma.tracking.findUnique({ where: { id: input.trackingId }, select: { organizationId: true, name: true } });
  if (tracking) {
    await logActivity({
      organizationId: tracking.organizationId,
      userId: actor.id,
      userName: actor.name,
      userEmail: actor.email,
      userImage: actor.image,
      appSlug: "tracking",
      subAppSlug: "tracking-pipeline",
      featureKey: "lead.created",
      action: "lead_create",
      actionLabel: withVia(`Criou o lead "${input.name}"`, via),
      resource: input.name,
      resourceId: lead.id,
      metadata: { phone: input.phone, trackingName: tracking.name, ...viaMetadata(via) },
    });

    await chargeStarsByAction(tracking.organizationId, "lead_create", {
      userId: actor.id,
      description: `Criou lead "${input.name}"`,
      appSlug: "tracking",
    });
  }

  return { lead: toCreatedLead(lead), isNewLead };
}

function toCreatedLead(lead: { id: string; name: string; phone: string | null; email: string | null; description: string | null; statusId: string; trackingId: string; createdAt: Date }) {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    description: lead.description,
    statusId: lead.statusId,
    trackingId: lead.trackingId,
    createdAt: lead.createdAt,
  };
}

export const LEAD_ADDRESS_FIELDS = [
  "addressZipCode",
  "addressStreet",
  "addressNumber",
  "addressComplement",
  "addressNeighborhood",
  "addressCity",
  "addressState",
  "addressCountry",
] as const;

type LeadAddressField = (typeof LEAD_ADDRESS_FIELDS)[number];

/** Só os campos de endereço que vieram; vazio vira null (limpa). */
function toAddressPatch(input: Partial<Record<LeadAddressField, string | null>>) {
  const patch: Partial<Record<LeadAddressField, string | null>> = {};
  for (const field of LEAD_ADDRESS_FIELDS) {
    if (input[field] !== undefined) patch[field] = input[field]?.trim() || null;
  }
  return patch;
}

export type UpdateLeadInput = {
  id: string;
  name?: string;
  nickname?: string | null;
  phone?: string;
  email?: string;
  description?: string;
  statusId?: string;
  responsibleId?: string;
  tagIds?: string[];
  active?: boolean;
  statusFlow?: "WAITING" | "ACTIVE" | "FINISHED";
  amount?: number;
  trackingId?: string;
  orgProjectId?: string | null;
  temperature?: "COLD" | "WARM" | "HOT" | "VERY_HOT";
} & Partial<Record<LeadAddressField, string | null>>;

export async function updateLeadRecord({ actor, via, input }: ActorContext & { input: UpdateLeadInput }) {
  const leadExists = await prisma.lead.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      statusId: true,
      trackingId: true,
      responsibleId: true,
      isActive: true,
      leadTags: { select: { tagId: true } },
      tracking: { select: { organizationId: true } },
    },
  });
  if (!leadExists) throw new ORPCError("NOT_FOUND");

  const isStatusChange = !!input.statusId && input.statusId !== leadExists.statusId;
  const isResponsibleChange = !!input.responsibleId && input.responsibleId !== leadExists.responsibleId;
  const now = new Date();
  const pendingLeadEvents: RecordLeadEventInput[] = [];

  const result = await prisma.$transaction(async (tx) => {
    let slaPatch: { statusEnteredAt?: Date | null; slaDeadline?: Date | null } = {};
    if (isStatusChange && input.statusId) {
      const newStatus = await tx.status.findUnique({ where: { id: input.statusId }, select: { id: true, slaHours: true } });
      const enteredAt = new Date();
      slaPatch = { statusEnteredAt: enteredAt, slaDeadline: computeSlaDeadline(newStatus, enteredAt) };
    }

    const lead = await tx.lead.update({
      where: { id: input.id },
      data: {
        name: input.name,
        // Apelido: string vazia ou null limpa; ausente não mexe.
        ...(input.nickname !== undefined ? { nickname: input.nickname?.trim() || null } : {}),
        ...toAddressPatch(input),
        phone: input.phone,
        email: input.email,
        description: input.description,
        statusId: input.statusId,
        trackingId: input.trackingId,
        orgProjectId: input.orgProjectId,
        responsibleId: input.responsibleId,
        isActive: input.active,
        amount: input.amount,
        ...(input.temperature ? { temperature: input.temperature } : {}),
        ...(isStatusChange ? { lastStatusChangeAt: now } : {}),
        ...(isResponsibleChange ? { assignedAt: now } : {}),
        // Com o estado de atendimento ligado o `statusFlow` é automático (spec 0113): o navegador não sobrescreve.
        ...(input.statusFlow && !isAttendanceStateEnabled(leadExists.tracking.organizationId) ? { statusFlow: input.statusFlow } : {}),
        ...slaPatch,
        leadTags: input.tagIds ? { deleteMany: {}, create: input.tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        description: true,
        statusId: true,
        trackingId: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        responsibleId: true,
      },
    });

    await recordLeadHistory({ leadId: lead.id, userId: actor.id, action: LeadAction.ACTIVE, notes: withVia("Lead atualizado", via), tx });

    // Disparados depois do commit: recordLeadEvent chama Pusher (regra 18).
    if (isStatusChange) {
      pendingLeadEvents.push({ leadId: lead.id, eventType: "STATUS_CHANGE", userId: actor.id, previousStatusId: leadExists.statusId, newStatusId: input.statusId });
    }
    if (input.trackingId && input.trackingId !== leadExists.trackingId) {
      pendingLeadEvents.push({ leadId: lead.id, eventType: "TRACKING_CHANGE", userId: actor.id, previousTrackingId: leadExists.trackingId, newTrackingId: input.trackingId });
    }
    if (input.responsibleId !== undefined && input.responsibleId !== leadExists.responsibleId) {
      pendingLeadEvents.push({
        leadId: lead.id,
        eventType: "RESPONSIBLE_CHANGE",
        userId: actor.id,
        previousResponsibleId: leadExists.responsibleId,
        newResponsibleId: input.responsibleId ?? null,
      });
    }

    // Acumula os gatilhos de etiqueta e de coluna; falha na busca não derruba o update.
    const workflows: { id: string }[] = [];
    if (input.tagIds && input.tagIds.length > 0) {
      try {
        workflows.push(
          ...(await tx.workflow.findMany({
            where: {
              trackingId: lead.trackingId,
              isActive: true,
              nodes: { some: { type: "LEAD_TAGGED", data: { path: ["action", "tagIds"], array_contains: input.tagIds } } },
            },
            select: { id: true },
          })),
        );
      } catch (error) {
        console.warn("[leads/update] tag workflows lookup failed", error);
      }
    }
    if (input.statusId) {
      try {
        workflows.push(
          ...(await tx.workflow.findMany({
            where: {
              trackingId: lead.trackingId,
              isActive: true,
              nodes: { some: { type: "MOVE_LEAD_STATUS", data: { path: ["action", "statusId"], equals: input.statusId } } },
            },
            select: { id: true },
          })),
        );
      } catch (error) {
        console.warn("[leads/update] status workflows lookup failed", error);
      }
    }

    return { lead, workflows };
  });

  if (pendingLeadEvents.length > 0) {
    await Promise.all(pendingLeadEvents.map((event) => recordLeadEvent(event)));
  }

  if (isStatusChange) {
    await eventBus.publish("lead.status_changed", {
      leadId: result.lead.id,
      fromStatusId: leadExists.statusId,
      toStatusId: result.lead.statusId,
      orgId: leadExists.tracking.organizationId,
      responsibleId: result.lead.responsibleId,
      actorUserId: actor.id,
    });
  }

  if (result.workflows.length > 0) {
    await Promise.all(
      result.workflows.map((workflow) => dispatchMoveLeadStatus({ workflowId: workflow.id, lead: result.lead, previousLead: leadExists })),
    );
  }

  if (isStatusChange) {
    await broadcastAgentWorkflowEvent({
      event: "lead-status-changed",
      leadId: result.lead.id,
      trackingId: result.lead.trackingId,
      extra: { fromStatusId: leadExists.statusId, toStatusId: result.lead.statusId },
    });
    await trackLeadEvent({ leadId: result.lead.id, kind: "status_changed", actorId: actor.id, metadata: { from: leadExists.statusId, to: input.statusId } });
  }
  if (isResponsibleChange) {
    await trackLeadEvent({ leadId: result.lead.id, kind: "lead_assigned", actorId: actor.id, metadata: { from: leadExists.responsibleId, to: input.responsibleId } });
  }
  // Um evento por etiqueta que entrou ou saiu, com `tagId` no singular: o formato do histórico de etiquetas do Insights.
  if (input.tagIds) {
    const previousTagIds = new Set(leadExists.leadTags.map((leadTag) => leadTag.tagId));
    const nextTagIds = new Set(input.tagIds);
    for (const tagId of input.tagIds.filter((tagId) => !previousTagIds.has(tagId))) {
      await trackLeadEvent({ leadId: result.lead.id, kind: "tag_added", actorId: actor.id, metadata: { tagId } });
    }
    for (const tagId of [...previousTagIds].filter((tagId) => !nextTagIds.has(tagId))) {
      await trackLeadEvent({ leadId: result.lead.id, kind: "tag_removed", actorId: actor.id, metadata: { tagId } });
    }
  }

  // Canal interno sempre: qualquer campo atualiza "Detalhes do lead" em tempo real.
  await notifyInternalLeadChannel(result.lead.id, "lead_updated");

  const tracking = await prisma.tracking.findUnique({ where: { id: result.lead.trackingId }, select: { organizationId: true, name: true } });
  if (tracking) {
    let actionLabel = `Atualizou o lead "${result.lead.name}"`;
    let featureKey = "lead.updated";
    const changedFields: string[] = [];
    if (isStatusChange && input.statusId) {
      const newStatus = await prisma.status.findUnique({ where: { id: input.statusId }, select: { name: true } });
      actionLabel = `Moveu o lead "${result.lead.name}" para a coluna "${newStatus?.name ?? input.statusId}"`;
      featureKey = "lead.moved";
    } else if (input.name && input.name !== leadExists.name) {
      actionLabel = `Renomeou o lead de "${leadExists.name}" para "${input.name}"`;
      featureKey = "lead.field.updated";
      changedFields.push("name");
    } else if (input.phone && input.phone !== leadExists.phone) {
      actionLabel = `Atualizou o telefone de "${result.lead.name}"`;
      featureKey = "lead.field.updated";
      changedFields.push("phone");
    } else if (input.email && input.email !== leadExists.email) {
      actionLabel = `Atualizou o e-mail de "${result.lead.name}"`;
      featureKey = "lead.field.updated";
      changedFields.push("email");
    } else if (input.active !== undefined && input.active !== leadExists.isActive) {
      // `active` é a IA do lead, não arquivamento: "lead.archived" é do arquivar de verdade.
      actionLabel = input.active ? `Ligou a IA do lead "${result.lead.name}"` : `Desligou a IA do lead "${result.lead.name}"`;
      featureKey = "lead.field.updated";
      changedFields.push("isActive");
    } else if (input.amount !== undefined) {
      actionLabel = `Atualizou o valor do lead "${result.lead.name}"`;
      featureKey = "lead.field.updated";
      changedFields.push("amount");
    } else if (input.tagIds) {
      actionLabel = `Atualizou tags do lead "${result.lead.name}"`;
      featureKey = "lead.tag.updated";
    } else if (isResponsibleChange) {
      actionLabel = `Trocou o responsável do lead "${result.lead.name}"`;
      featureKey = "lead.responsible.changed";
    }
    await logActivity({
      organizationId: tracking.organizationId,
      userId: actor.id,
      userName: actor.name,
      userEmail: actor.email,
      userImage: actor.image,
      appSlug: "tracking",
      subAppSlug: "tracking-pipeline",
      featureKey,
      action: featureKey === "lead.moved" ? "lead.moved" : "lead.updated",
      actionLabel: withVia(actionLabel, via),
      resource: result.lead.name,
      resourceId: result.lead.id,
      metadata: { trackingName: tracking.name, changedFields, fromStatusId: leadExists.statusId, toStatusId: input.statusId, ...viaMetadata(via) },
    });
  }

  return result;
}

export async function addLeadTagsRecord({ actor, via, leadId, tagIds }: ActorContext & { leadId: string; tagIds: string[] }) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new ORPCError("UNAUTHORIZED");

  // Nome e cor capturados antes: a Jornada do lead continua mostrando a tag depois que ela for arquivada.
  const tagsInfo = await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true, name: true, color: true } });
  const tagInfoById = new Map(tagsInfo.map((tag) => [tag.id, tag]));
  const pendingLeadEvents: RecordLeadEventInput[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.leadTag.createMany({ data: tagIds.map((tagId) => ({ leadId, tagId })), skipDuplicates: true });
    await recordLeadHistory({ leadId, userId: actor.id, action: lead.currentAction, notes: withVia("Tags adicionadas ao lead", via), tx });
    for (const tagId of tagIds) {
      const info = tagInfoById.get(tagId);
      pendingLeadEvents.push({
        leadId,
        eventType: "TAG_ADDED",
        userId: actor.id,
        metadata: { tagId, tagName: info?.name ?? null, tagColor: info?.color ?? null },
      });
    }
    const workflows = await findLeadTaggedMatchingWorkflows({ tx, trackingId: lead.trackingId, tagIds });
    return { count: created.count, workflows };
  });

  if (pendingLeadEvents.length > 0) {
    await Promise.all(pendingLeadEvents.map((event) => recordLeadEvent(event)));
  }

  if (result.count > 0) {
    await publishLeadChanged({ leadId: lead.id, trackingId: lead.trackingId, statusId: lead.statusId, fields: ["tag"] });
  }

  if (result.workflows.length > 0) {
    const leadMessage = await getLastLeadMessage(lead.id);
    await Promise.all(result.workflows.map((workflow) => dispatchLeadTagged({ workflowId: workflow.id, lead, tagIds, leadMessage })));
  }

  // Acorda os fluxos com "esperar etiqueta" deste lead, além dos gatilhos LEAD_TAGGED acima.
  await broadcastAgentWorkflowEvent({ event: "lead-tagged", leadId: lead.id, trackingId: lead.trackingId, extra: { tagIds } });

  const tracking = await prisma.tracking.findUnique({ where: { id: lead.trackingId }, select: { organizationId: true, name: true } });
  if (tracking) {
    await logActivity({
      organizationId: tracking.organizationId,
      userId: actor.id,
      userName: actor.name,
      userEmail: actor.email,
      userImage: actor.image,
      appSlug: "tracking",
      subAppSlug: "tracking-pipeline",
      featureKey: "lead.tag.added",
      action: "lead.tag.added",
      actionLabel: withVia(`Adicionou ${result.count} tag(s) ao lead "${lead.name}"`, via),
      resource: lead.name,
      resourceId: lead.id,
      metadata: { trackingName: tracking.name, tagIds, tagNames: tagsInfo.map((tag) => tag.name), count: result.count, ...viaMetadata(via) },
    });

    await Promise.all(
      tagIds.map((tagId) =>
        eventBus.publish("lead.tag_added", { leadId: lead.id, tagId, orgId: tracking.organizationId, responsibleId: lead.responsibleId ?? null }),
      ),
    );
  }

  return { count: result.count };
}

export async function removeLeadTagsRecord({ actor, via, leadId, tagIds }: ActorContext & { leadId: string; tagIds: string[] }) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new ORPCError("UNAUTHORIZED");

  const tagsInfo = await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true, name: true, color: true } });
  const tagInfoById = new Map(tagsInfo.map((tag) => [tag.id, tag]));
  const pendingLeadEvents: RecordLeadEventInput[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.leadTag.deleteMany({ where: { leadId, tagId: { in: tagIds } } });
    await recordLeadHistory({ leadId, userId: actor.id, action: lead.currentAction, notes: withVia("Tags removidas do lead", via), tx });
    for (const tagId of tagIds) {
      const info = tagInfoById.get(tagId);
      pendingLeadEvents.push({
        leadId,
        eventType: "TAG_REMOVED",
        userId: actor.id,
        metadata: { tagId, tagName: info?.name ?? null, tagColor: info?.color ?? null },
      });
    }
    return deleted;
  });

  if (pendingLeadEvents.length > 0) {
    await Promise.all(pendingLeadEvents.map((event) => recordLeadEvent(event)));
  }

  if (result.count > 0) {
    await publishLeadChanged({ leadId: lead.id, trackingId: lead.trackingId, statusId: lead.statusId, fields: ["tag"] });
  }

  const tracking = await prisma.tracking.findUnique({ where: { id: lead.trackingId }, select: { organizationId: true, name: true } });
  if (tracking) {
    await logActivity({
      organizationId: tracking.organizationId,
      userId: actor.id,
      userName: actor.name,
      userEmail: actor.email,
      userImage: actor.image,
      appSlug: "tracking",
      subAppSlug: "tracking-pipeline",
      featureKey: "lead.tag.removed",
      action: "lead.tag.removed",
      actionLabel: withVia(`Removeu ${result.count} tag(s) do lead "${lead.name}"`, via),
      resource: lead.name,
      resourceId: lead.id,
      metadata: { trackingName: tracking.name, tagIds, count: result.count, ...viaMetadata(via) },
    });
  }

  return { count: result.count };
}

/** Anotação no histórico do lead (aparece como "nota" na jornada). Não muda o estado do lead. */
export async function addLeadNoteRecord({ actor, via, leadId, notes }: ActorContext & { leadId: string; notes: string }) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { id: true, name: true, currentAction: true, trackingId: true } });
  const history = await prisma.leadHistory.create({
    data: { leadId, userId: actor.id, action: lead.currentAction, eventType: "NOTE", notes, metadata: viaMetadata(via) },
    select: { id: true, createdAt: true },
  });
  await notifyInternalLeadChannel(leadId, "NOTE");

  const tracking = await prisma.tracking.findUnique({ where: { id: lead.trackingId }, select: { organizationId: true, name: true } });
  if (tracking) {
    await logActivity({
      organizationId: tracking.organizationId,
      userId: actor.id,
      userName: actor.name,
      userEmail: actor.email,
      userImage: actor.image,
      appSlug: "tracking",
      subAppSlug: "tracking-pipeline",
      featureKey: "lead.note.added",
      action: "lead.note.added",
      actionLabel: withVia(`Anotou no lead "${lead.name}"`, via),
      resource: lead.name,
      resourceId: lead.id,
      metadata: { trackingName: tracking.name, ...viaMetadata(via) },
    });
  }
  return history;
}
