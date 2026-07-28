import prisma from "@/lib/prisma";

export interface ActionAccessResult {
  hasAccess: boolean;
  action: {
    id: string;
    title: string;
    workspaceId: string;
    organizationId: string | null;
  } | null;
  participantUserIds: string[];
}

export async function assertActionAccess(
  actionId: string,
  userId: string,
  org: { id: string; members: any },
): Promise<ActionAccessResult> {
  // Escopo de org primeiro: `canSeeByOrg` abaixo avalia o papel do chamador
  // na org ATIVA dele, então sem esse filtro um admin liberava o chat de
  // ações de qualquer tenant.
  const action = await prisma.action.findFirst({
    where: { id: actionId, workspace: { organizationId: org.id } },
    select: {
      id: true,
      title: true,
      workspaceId: true,
      organizationId: true,
      participants: { select: { userId: true } },
    },
  });

  if (!action) return { hasAccess: false, action: null, participantUserIds: [] };

  const participantUserIds = action.participants.map((p) => p.userId);
  const isParticipant = participantUserIds.includes(userId);

  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: action.workspaceId,
        userId,
      },
    },
  });
  const isWorkspaceOwner = workspaceMember?.role === "OWNER";

  const orgMembers = (org.members as any[]) ?? [];
  const orgMember = orgMembers.find((m: any) => m.userId === userId);
  const canSeeByOrg =
    orgMember?.role === "owner" ||
    orgMember?.role === "admin" ||
    orgMember?.role === "moderador";

  const hasAccess = isParticipant || isWorkspaceOwner || canSeeByOrg;

  return {
    hasAccess,
    action: {
      id: action.id,
      title: action.title,
      workspaceId: action.workspaceId,
      organizationId: action.organizationId,
    },
    participantUserIds,
  };
}
