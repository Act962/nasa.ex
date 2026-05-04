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
  const action = await prisma.action.findUnique({
    where: { id: actionId },
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
