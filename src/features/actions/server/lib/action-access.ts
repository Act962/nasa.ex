// Isolamento de tenant das procedures de action. O dono de verdade de uma
// ação é o workspace: `Action.organizationId` é opcional e ficou nulo em
// ações antigas, então filtrar por ele deixaria buracos. Todo acesso por id
// passa por aqui antes de ler/escrever. Ver docs/workspace-actions-overview.md
// §6.1, débitos S4/S5.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import prismaDefault from "@/lib/prisma";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const SCOPED_ACTION_SELECT = {
  id: true,
  title: true,
  workspaceId: true,
  columnId: true,
  organizationId: true,
  createdBy: true,
} satisfies Prisma.ActionSelect;

export type ScopedAction = Prisma.ActionGetPayload<{
  select: typeof SCOPED_ACTION_SELECT;
}>;

export function findActionInOrg(
  actionId: string,
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  return prisma.action.findFirst({
    where: { id: actionId, workspace: { organizationId } },
    select: SCOPED_ACTION_SELECT,
  });
}

export function findSubActionInOrg(
  subActionId: string,
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  return prisma.subActions.findFirst({
    where: { id: subActionId, action: { workspace: { organizationId } } },
    select: {
      id: true,
      actionId: true,
      action: { select: SCOPED_ACTION_SELECT },
    },
  });
}

export function findSubActionGroupInOrg(
  groupId: string,
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  return prisma.subActionGroup.findFirst({
    where: { id: groupId, action: { workspace: { organizationId } } },
    select: { id: true, actionId: true },
  });
}

export function findWorkspaceInOrg(
  workspaceId: string,
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  return prisma.workspace.findFirst({
    where: { id: workspaceId, organizationId },
    select: { id: true, trackingId: true },
  });
}

export function findColumnInOrg(
  columnId: string,
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  return prisma.workspaceColumn.findFirst({
    where: { id: columnId, workspace: { organizationId } },
    select: { id: true, workspaceId: true },
  });
}

// Alvo de vínculo (participante/responsável) precisa ser da mesma org, senão
// dá pra plugar qualquer usuário da plataforma numa ação e derrubá-la no
// calendário/listas dele.
export async function isOrgMember(
  userId: string,
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  const member = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { id: true },
  });

  return member !== null;
}

// Para procedures que recebem lote de ids (reorder, unread-counts): devolve
// só os que pertencem à org, deixando a rota decidir entre rejeitar tudo ou
// ignorar os intrusos.
export async function filterActionIdsInOrg(
  actionIds: string[],
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  if (actionIds.length === 0) return [];

  const actions = await prisma.action.findMany({
    where: { id: { in: actionIds }, workspace: { organizationId } },
    select: { id: true },
  });

  return actions.map((action) => action.id);
}

export async function areSubActionsInOrg(
  subActionIds: string[],
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  if (subActionIds.length === 0) return true;

  const total = await prisma.subActions.count({
    where: {
      id: { in: subActionIds },
      action: { workspace: { organizationId } },
    },
  });

  return total === subActionIds.length;
}

export async function areSubActionGroupsInOrg(
  groupIds: string[],
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  if (groupIds.length === 0) return true;

  const total = await prisma.subActionGroup.count({
    where: {
      id: { in: groupIds },
      action: { workspace: { organizationId } },
    },
  });

  return total === groupIds.length;
}
