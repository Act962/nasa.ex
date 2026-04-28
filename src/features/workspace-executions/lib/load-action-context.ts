import prisma from "@/lib/prisma";
import { ActionDetail } from "../schemas";

export async function loadActionContext(
  actionId: string,
): Promise<ActionDetail | null> {
  const action = await prisma.action.findUnique({
    where: { id: actionId },
    include: {
      participants: { select: { userId: true } },
      responsibles: { select: { userId: true } },
      tags: { select: { tagId: true } },
    },
  });

  if (!action) return null;

  return {
    id: action.id,
    title: action.title,
    isDone: action.isDone,
    workspaceId: action.workspaceId,
    columnId: action.columnId,
    priority: action.priority,
    dueDate: action.dueDate,
    participantIds: action.participants.map((p) => p.userId),
    responsibleIds: action.responsibles.map((r) => r.userId),
    tagIds: action.tags.map((t) => t.tagId),
  };
}
