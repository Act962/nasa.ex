// Autorização de edição/exclusão de action. Não existia guarda de dono/papel:
// `action.update` rodava só com escopo de tenant. Aqui centralizamos quem pode
// mexer numa action — owner/admin/moderador da org, dono do workspace, criador
// e participantes — e quem NÃO pode excluir (participante, a op perigosa).
// Ver docs/lead-actions-overview.md.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import prismaDefault from "@/lib/prisma";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const PRIVILEGED_ORG_ROLES = ["owner", "admin", "moderador"] as const;

type OrgLike = { id: string; members: unknown };

type OrgMember = { userId: string; role: string };

export type ActionForPermission = {
  id: string;
  createdBy: string;
  workspaceId: string;
  participants: { userId: string }[];
};

export type ActionPermissions = {
  action: ActionForPermission;
  orgRole: string | undefined;
  isPrivileged: boolean;
  isWorkspaceOwner: boolean;
  isCreator: boolean;
  isParticipant: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

const ACTION_PERMISSION_SELECT = {
  id: true,
  createdBy: true,
  workspaceId: true,
  participants: { select: { userId: true } },
} satisfies Prisma.ActionSelect;

// Resolve os papéis do chamador sobre uma action e devolve as duas decisões
// (`canEdit`/`canDelete`). Retorna `null` quando a action não existe ou é de
// outra org — o chamador converte em NOT_FOUND. Aceita uma action já carregada
// (com participants) para não reler o banco em quem já buscou `previous`.
export async function resolveActionAccess(
  actionId: string,
  context: { userId: string; org: OrgLike },
  options: { action?: ActionForPermission; prisma?: PrismaLike } = {},
): Promise<ActionPermissions | null> {
  const prisma = options.prisma ?? prismaDefault;

  const action =
    options.action ??
    (await prisma.action.findFirst({
      where: { id: actionId, workspace: { organizationId: context.org.id } },
      select: ACTION_PERMISSION_SELECT,
    }));

  if (!action) return null;

  const orgMembers = (context.org.members as OrgMember[] | undefined) ?? [];
  const orgRole = orgMembers.find(
    (member) => member.userId === context.userId,
  )?.role;
  const isPrivileged = orgRole
    ? (PRIVILEGED_ORG_ROLES as readonly string[]).includes(orgRole)
    : false;

  const isCreator = action.createdBy === context.userId;
  const isParticipant = action.participants.some(
    (participant) => participant.userId === context.userId,
  );

  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: action.workspaceId,
        userId: context.userId,
      },
    },
    select: { role: true },
  });
  const isWorkspaceOwner = workspaceMember?.role === "OWNER";

  // Participante entra em `canEdit` mas fica de fora de `canDelete` — excluir é
  // a operação perigosa que o requisito manda bloquear pra participante.
  const canEdit = isPrivileged || isWorkspaceOwner || isCreator || isParticipant;
  const canDelete = isPrivileged || isWorkspaceOwner || isCreator;

  return {
    action,
    orgRole,
    isPrivileged,
    isWorkspaceOwner,
    isCreator,
    isParticipant,
    canEdit,
    canDelete,
  };
}
