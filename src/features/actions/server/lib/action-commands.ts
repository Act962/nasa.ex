import "server-only";
import { ORPCError } from "@orpc/server";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { awardPoints } from "@/app/router/space-point/utils";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { logOrgActivity } from "@/features/admin/lib/org-activity-log";
import { resolveWorkspaceTrackingId } from "@/features/actions/lib/workspace-tracking";
import { generatePublicSlug } from "@/features/public-calendar/utils/slug";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { findColumnInOrg as findWorkspaceColumnInOrg, findTagInOrg } from "@/features/workspace/server/lib/workspace-access";
import {
  hasActionCreatedWorkflow,
  hasMovedColumnWorkflow,
  hasTaggedWorkflow,
  sendWorkspaceWorkflowEvent,
} from "@/inngest/utils";
import { findActionInOrg, findColumnInOrg, findSubActionGroupInOrg, isOrgMember } from "./action-access";
import { resolveActionAccess } from "./can-edit-action";
import { runActionCompletedEffects } from "./complete-action";
import { notifyNewTask } from "./notify-new-task";

// Escritas de card usadas pela tela (rotas oRPC) e pelo MCP (spec 0143, D-2): mesmos efeitos nos dois caminhos.

export interface ActionActor {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface ActionCommandOrg {
  id: string;
  members: unknown;
}

/** `via` é o nome da IA externa: entra no texto e no `metadata` do histórico (spec 0143, RF-6). */
interface ActorContext {
  organizationId: string;
  actor: ActionActor;
  via?: string;
}

export const EVENT_CATEGORY_VALUES = [
  "WORKSHOP",
  "PALESTRA",
  "LANCAMENTO",
  "WEBINAR",
  "NETWORKING",
  "CURSO",
  "REUNIAO",
  "HACKATHON",
  "CONFERENCIA",
  "OUTRO",
] as const;

type EventCategory = (typeof EVENT_CATEGORY_VALUES)[number];
type ActionPriority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const withVia = (label: string, via?: string) => (via ? `${label} (via ${via})` : label);
const viaMetadata = (via?: string) => (via ? { via } : {});

async function generateUniquePublicSlug(title: string): Promise<string | undefined> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidate = generatePublicSlug(title);
    const exists = await prisma.action.findUnique({ where: { publicSlug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return undefined;
}

export interface CreateWorkspaceActionInput {
  title: string;
  description?: string;
  priority: ActionPriority;
  dueDate?: Date;
  startDate?: Date;
  workspaceId: string;
  columnId: string;
  orgProjectId?: string;
  participantIds?: string[];
  responsibleIds?: string[];
  isPublic?: boolean;
  eventCategory?: EventCategory | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  registrationUrl?: string | null;
}

export async function createWorkspaceAction({ organizationId, actor, via, input }: ActorContext & { input: CreateWorkspaceActionInput }) {
  // Sem validar destino, um id de workspace/coluna de outra org injeta o card no board alheio.
  const column = await findColumnInOrg(input.columnId, organizationId);
  if (!column || column.workspaceId !== input.workspaceId) {
    throw new ORPCError("NOT_FOUND", { message: "Coluna não encontrada" });
  }

  if (input.orgProjectId) {
    const orgProject = await prisma.orgProject.findFirst({ where: { id: input.orgProjectId, organizationId }, select: { id: true } });
    if (!orgProject) throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
  }

  const firstAction = await prisma.action.findFirst({
    where: { columnId: input.columnId, workspaceId: input.workspaceId },
    orderBy: { order: "asc" },
  });
  const order = firstAction ? Prisma.Decimal.sub(firstAction.order, 1) : new Prisma.Decimal(0);

  const publicSlug = input.isPublic ? await generateUniquePublicSlug(input.title) : undefined;
  const publishedAt = input.isPublic ? new Date() : undefined;
  const trackingId = await resolveWorkspaceTrackingId(input.workspaceId);
  const responsibleIds = [...new Set(input.responsibleIds ?? [])];

  const action = await prisma.action.create({
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueDate: input.dueDate,
      startDate: input.startDate,
      workspaceId: input.workspaceId,
      // Obrigatório para aparecer no calendário do workspace (`getWorkspaceCalendar` filtra por ele).
      organizationId,
      trackingId,
      order,
      columnId: input.columnId,
      orgProjectId: input.orgProjectId,
      createdBy: actor.id,
      isPublic: input.isPublic ?? false,
      publicSlug,
      publishedAt,
      eventCategory: input.eventCategory ?? undefined,
      state: input.state ?? undefined,
      city: input.city ?? undefined,
      address: input.address ?? undefined,
      registrationUrl: input.registrationUrl ?? undefined,
      participants: {
        create: Array.from(new Set([actor.id, ...(input.participantIds ?? [])])).map((userId) => ({ userId })),
      },
      ...(responsibleIds.length > 0 ? { responsibles: { create: responsibleIds.map((userId) => ({ userId })) } } : {}),
    },
  });

  await notifyNewTask({
    actionId: action.id,
    title: action.title,
    workspaceId: action.workspaceId,
    organizationId,
    actorId: actor.id,
    actorName: actor.name,
    userIds: [...(input.participantIds ?? []), ...responsibleIds],
  });

  try {
    if (await hasActionCreatedWorkflow(action.workspaceId)) {
      await sendWorkspaceWorkflowEvent({ trigger: "WS_ACTION_CREATED", workspaceId: action.workspaceId, actionId: action.id });
    }
  } catch (error) {
    console.error("[workspace-workflow] failed to emit action.created", error);
  }

  await logActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name,
    userEmail: actor.email,
    userImage: actor.image,
    appSlug: "workspace",
    subAppSlug: "workspace-actions",
    featureKey: input.isPublic ? "workspace.action.created.public" : "workspace.action.created",
    action: "workspace_action_create",
    actionLabel: withVia(`Criou a ação "${action.title}"`, via),
    resource: action.title,
    resourceId: action.id,
    metadata: { priority: input.priority, isPublic: input.isPublic ?? false, ...viaMetadata(via) },
  });

  await chargeStarsByAction(organizationId, "workspace_action_create", {
    userId: actor.id,
    description: `Criou ação "${action.title}"`,
    appSlug: "workspace",
  });

  return action;
}

export interface UpdateWorkspaceActionInput {
  actionId: string;
  title?: string;
  description?: string | null;
  priority?: ActionPriority;
  columnId?: string | null;
  dueDate?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
  isDone?: boolean;
  orgProjectId?: string | null;
  isPublic?: boolean;
  eventCategory?: EventCategory | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  registrationUrl?: string | null;
  /** Consentimento de "Visualização Pública": obrigatório ao tornar público um evento privado. */
  consent?: boolean;
}

export async function updateWorkspaceAction({ org, actor, via, input }: { org: ActionCommandOrg; actor: ActionActor; via?: string; input: UpdateWorkspaceActionInput }) {
  const { actionId, consent, ...data } = input;
  const organizationId = org.id;

  const previous = await prisma.action.findFirst({
    where: { id: actionId, workspace: { organizationId } },
    include: { participants: { select: { userId: true } } },
  });
  if (!previous) throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada" });

  const access = await resolveActionAccess(actionId, { userId: actor.id, org }, { action: previous });
  if (!access?.canEdit) throw new ORPCError("FORBIDDEN", { message: "Você não tem permissão para editar esta ação" });

  // Coluna destino da mesma org, senão dá para empurrar a ação para o board de outro tenant.
  if (data.columnId) {
    const column = await findColumnInOrg(data.columnId, organizationId);
    if (!column || column.workspaceId !== previous.workspaceId) throw new ORPCError("NOT_FOUND", { message: "Coluna não encontrada" });
  }

  if (data.orgProjectId) {
    const orgProject = await prisma.orgProject.findFirst({ where: { id: data.orgProjectId, organizationId }, select: { id: true } });
    if (!orgProject) throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
  }

  // Toda publicação passa pelo aviso explícito: virar público sem `consent` é recusado.
  if (data.isPublic === true && !previous.isPublic && consent !== true) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Consentimento obrigatório pra tornar o evento público. Confirme o aviso de visualização pública.",
    });
  }

  let publicSlug: string | undefined;
  let publishedAt: Date | null | undefined;
  if (data.isPublic === true && !previous.publicSlug) {
    publicSlug = await generateUniquePublicSlug(previous.title);
    publishedAt = new Date();
  } else if (data.isPublic === false && previous.isPublic) {
    // Despublicar mantém o slug e limpa publishedAt.
    publishedAt = null;
  }

  const action = await prisma.action.update({
    where: { id: actionId },
    data: {
      ...data,
      ...(publicSlug ? { publicSlug } : {}),
      ...(publishedAt !== undefined ? { publishedAt } : {}),
      closedAt: data.isDone === true ? new Date() : data.isDone === false ? null : undefined,
    },
  });

  if (!previous.isDone && data.isDone === true) {
    await awardPoints(previous.createdBy, organizationId, "complete_card", "Card concluído ✅");
  }

  const changedFields: string[] = [];
  if (data.title !== undefined && data.title !== previous.title) changedFields.push("title");
  if (data.description !== undefined && data.description !== previous.description) changedFields.push("description");
  if (data.priority !== undefined && data.priority !== previous.priority) changedFields.push("priority");
  if (data.columnId !== undefined && data.columnId !== previous.columnId) changedFields.push("columnId");
  if (data.dueDate !== undefined) changedFields.push("dueDate");
  if (data.isPublic !== undefined && data.isPublic !== previous.isPublic) changedFields.push("isPublic");

  let featureKey = "workspace.action.updated";
  let actionLabel = `Atualizou a ação "${action.title}"`;
  let isPublicChange = false;
  if (data.isDone === true && !previous.isDone) {
    featureKey = "workspace.action.completed";
    actionLabel = `Concluiu a ação "${action.title}"`;
  } else if (data.isDone === false && previous.isDone) {
    featureKey = "workspace.action.reopened";
    actionLabel = `Reabriu a ação "${action.title}"`;
  } else if (data.isPublic === true && !previous.isPublic) {
    featureKey = "workspace.action.made_public";
    actionLabel = `Tornou o evento "${action.title}" público — aparece no calendário público e na Spacehome.`;
    isPublicChange = true;
  } else if (data.isPublic === false && previous.isPublic) {
    featureKey = "workspace.action.made_private";
    actionLabel = `Tornou o evento "${action.title}" privado — removido do calendário público.`;
  } else if (data.columnId !== undefined && data.columnId !== previous.columnId) {
    featureKey = "workspace.action.moved";
    actionLabel = `Moveu a ação "${action.title}" entre colunas`;
  }

  await logActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name,
    userEmail: actor.email,
    userImage: actor.image,
    appSlug: "workspace",
    subAppSlug: "workspace-actions",
    featureKey,
    action: featureKey,
    actionLabel: withVia(actionLabel, via),
    resource: action.title,
    resourceId: action.id,
    metadata: isPublicChange
      ? { changedFields, isPublic: true, consentGiven: consent === true, ...viaMetadata(via) }
      : { changedFields, ...viaMetadata(via) },
  });

  return action;
}

export async function moveWorkspaceAction({
  organizationId,
  actor,
  via,
  actionId,
  columnId,
  workspaceId,
}: ActorContext & { actionId: string; columnId: string; workspaceId: string }) {
  const existing = await findActionInOrg(actionId, organizationId);
  if (!existing) throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada" });

  // Destino também escopado: sem isso a ação vai para workspace/coluna de outra org só passando o id.
  const targetColumn = await findWorkspaceColumnInOrg(columnId, organizationId);
  if (!targetColumn || targetColumn.workspaceId !== workspaceId) throw new ORPCError("NOT_FOUND", { message: "Coluna não encontrada" });

  // Mudar de workspace pode mudar o tracking: re-resolve em vez de manter o do workspace de origem.
  const trackingId = await resolveWorkspaceTrackingId(workspaceId);
  const action = await prisma.action.update({ where: { id: actionId }, data: { columnId, workspaceId, trackingId } });

  await logOrgActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name ?? "Usuário",
    userEmail: actor.email ?? "",
    action: "action.moved",
    resource: "action",
    resourceId: action.id,
    metadata: {
      from: { columnId: existing.columnId, workspaceId: existing.workspaceId },
      to: { columnId, workspaceId },
      ...viaMetadata(via),
    },
  });

  if (existing.columnId !== columnId) {
    try {
      if (await hasMovedColumnWorkflow(workspaceId, columnId)) {
        await sendWorkspaceWorkflowEvent({ trigger: "WS_ACTION_MOVED_COLUMN", workspaceId, actionId, columnId });
      }
    } catch (error) {
      console.error("[workspace-workflow] failed to emit action.moved", error);
    }
  }

  return action;
}

export async function setWorkspaceActionDone({ organizationId, actor, via, actionId, isDone }: ActorContext & { actionId: string; isDone: boolean }) {
  const previous = await prisma.action.findFirst({
    where: { id: actionId, workspace: { organizationId } },
    select: { id: true, isDone: true, title: true, createdBy: true },
  });
  if (!previous) throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada" });

  const action = await prisma.action.update({
    where: { id: actionId },
    data: { isDone, closedAt: isDone ? new Date() : null },
  });

  if (!previous.isDone && isDone) {
    await runActionCompletedEffects({
      action: { id: action.id, title: action.title, createdBy: previous.createdBy, workspaceId: action.workspaceId },
      organizationId,
      actor,
      via,
    });
  }

  if (previous.isDone && !isDone) {
    await logActivity({
      organizationId,
      userId: actor.id,
      userName: actor.name,
      userEmail: actor.email,
      userImage: actor.image,
      appSlug: "workspace",
      subAppSlug: "workspace-actions",
      featureKey: "workspace.action.reopened",
      action: "workspace.action.reopened",
      actionLabel: withVia(`Reabriu a ação "${action.title}"`, via),
      resource: action.title,
      resourceId: action.id,
      metadata: { changedFields: ["isDone"], ...viaMetadata(via) },
    });
  }

  return action;
}

export async function addActionTag({ organizationId, actionId, tagId }: { organizationId: string; actionId: string; tagId: string }) {
  const action = await findActionInOrg(actionId, organizationId);
  if (!action) throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada" });

  const tag = await findTagInOrg(tagId, organizationId);
  if (!tag || tag.workspaceId !== action.workspaceId) throw new ORPCError("NOT_FOUND", { message: "Tag não encontrada" });

  await prisma.actionTag.upsert({
    where: { actionId_tagId: { actionId, tagId } },
    create: { actionId, tagId },
    update: {},
  });

  try {
    if (await hasTaggedWorkflow(action.workspaceId, tagId)) {
      await sendWorkspaceWorkflowEvent({ trigger: "WS_ACTION_TAGGED", workspaceId: action.workspaceId, actionId, tagId });
    }
  } catch (error) {
    console.error("[workspace-workflow] failed to emit action.tagged", error);
  }
}

export async function removeActionTag({ organizationId, actionId, tagId }: { organizationId: string; actionId: string; tagId: string }) {
  const action = await findActionInOrg(actionId, organizationId);
  if (!action) throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada" });
  await prisma.actionTag.delete({ where: { actionId_tagId: { actionId, tagId } } });
}

export async function addActionResponsible({ organizationId, actor, actionId, userId }: ActorContext & { actionId: string; userId: string }) {
  const action = await findActionInOrg(actionId, organizationId);
  if (!action) throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada" });
  if (!(await isOrgMember(userId, organizationId))) throw new ORPCError("FORBIDDEN", { message: "Usuário não pertence a esta organização" });

  const wasAlreadyInTask = await prisma.actionsUserResponsible.findUnique({
    where: { actionId_userId: { actionId, userId } },
    select: { userId: true },
  });

  const responsible = await prisma.actionsUserResponsible.upsert({
    where: { actionId_userId: { actionId, userId } },
    create: { actionId, userId },
    update: {},
    include: {
      user: { select: { id: true, name: true, image: true, email: true } },
      action: { select: { id: true, workspaceId: true, title: true } },
    },
  });

  if (!wasAlreadyInTask) {
    await notifyNewTask({
      actionId: responsible.action.id,
      title: responsible.action.title,
      workspaceId: responsible.action.workspaceId,
      organizationId,
      actorId: actor.id,
      actorName: actor.name,
      userIds: [userId],
    });
  }

  return responsible;
}

export async function removeActionResponsible({ organizationId, actionId, userId }: { organizationId: string; actionId: string; userId: string }) {
  const action = await findActionInOrg(actionId, organizationId);
  if (!action) throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada" });

  return prisma.actionsUserResponsible.delete({
    where: { actionId_userId: { actionId, userId } },
    include: { action: { select: { id: true, workspaceId: true } } },
  });
}

export async function addActionParticipant({ organizationId, actor, actionId, userId }: ActorContext & { actionId: string; userId: string }) {
  const action = await findActionInOrg(actionId, organizationId);
  if (!action) throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada" });
  if (!(await isOrgMember(userId, organizationId))) throw new ORPCError("FORBIDDEN", { message: "Usuário não pertence a esta organização" });

  const wasAlreadyInTask = await prisma.actionsUserParticipant.findUnique({
    where: { actionId_userId: { actionId, userId } },
    select: { userId: true },
  });

  const participant = await prisma.actionsUserParticipant.upsert({
    where: { actionId_userId: { actionId, userId } },
    create: { actionId, userId },
    update: {},
    include: {
      user: { select: { id: true, name: true, image: true, email: true } },
      action: { select: { id: true, workspaceId: true, title: true } },
    },
  });

  try {
    await sendWorkspaceWorkflowEvent({ trigger: "WS_ACTION_PARTICIPANT_ADDED", workspaceId: participant.action.workspaceId, actionId: participant.action.id });
  } catch (error) {
    console.error("[workspace-workflow] failed to emit action.participant.added", error);
  }

  if (!wasAlreadyInTask) {
    await notifyNewTask({
      actionId: participant.action.id,
      title: participant.action.title,
      workspaceId: participant.action.workspaceId,
      organizationId,
      actorId: actor.id,
      actorName: actor.name,
      userIds: [userId],
    });
  }

  return participant;
}

export async function addActionChecklistItem({
  organizationId,
  actor,
  via,
  actionId,
  title,
  finishDate,
  groupId,
}: ActorContext & { actionId: string; title: string; finishDate?: Date; groupId?: string | null }) {
  const action = await findActionInOrg(actionId, organizationId);
  if (!action) throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada" });

  if (groupId) {
    const group = await findSubActionGroupInOrg(groupId, organizationId);
    if (!group || group.actionId !== actionId) throw new ORPCError("NOT_FOUND", { message: "Grupo não encontrado" });
  }

  const last = await prisma.subActions.findFirst({
    where: { actionId, groupId: groupId ?? null },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const subAction = await prisma.subActions.create({
    data: { title, actionId, finishDate, groupId: groupId ?? null, order: (last?.order ?? -1) + 1 },
    include: {
      responsibles: { select: { user: { select: { id: true, name: true, image: true } } } },
      action: { select: { id: true, workspaceId: true } },
    },
  });

  await logOrgActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name ?? "Usuário",
    userEmail: actor.email ?? "",
    action: "action.checklist_added",
    resource: "action",
    resourceId: actionId,
    metadata: { subActionId: subAction.id, title: subAction.title, ...viaMetadata(via) },
  });

  return subAction;
}
