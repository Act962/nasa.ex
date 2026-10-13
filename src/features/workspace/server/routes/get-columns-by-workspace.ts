import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findWorkspaceInOrg } from "../lib/workspace-access";

const BRAZIL_OFFSET_MS = -3 * 60 * 60_000;

function startOfBrazilToday(): Date {
  const wallClock = new Date(Date.now() + BRAZIL_OFFSET_MS);
  wallClock.setUTCHours(0, 0, 0, 0);
  return new Date(wallClock.getTime() - BRAZIL_OFFSET_MS);
}

export const getColumnsByWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string().min(1, "Workspace é obrigatório"),
      participantIds: z.array(z.string()).optional().default([]),
      tagIds: z.array(z.string()).optional().default([]),
      projectIds: z.array(z.string()).optional().default([]),
      dueDateFrom: z.coerce.date().nullable().optional(),
      dueDateTo: z.coerce.date().nullable().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findUnique({
      where: {
        userId_organizationId: {
          userId: context.user.id,
          organizationId: context.org.id,
        },
      },
    });

    if (!member) {
      throw errors.FORBIDDEN;
    }

    const workspace = await findWorkspaceInOrg(input.workspaceId, context.org.id);
    if (!workspace) {
      throw errors.NOT_FOUND({ message: "Workspace não encontrado" });
    }

    const isMember = member.role === "member";

    const visibleActions = {
      isArchived: false,
      ...(input.participantIds.length > 0 && {
        participants: {
          some: { userId: { in: input.participantIds } },
        },
      }),
      ...(input.tagIds.length > 0 && {
        tags: { some: { tagId: { in: input.tagIds } } },
      }),
      ...(input.projectIds.length > 0 && {
        orgProjectId: { in: input.projectIds },
      }),
      ...((input.dueDateFrom || input.dueDateTo) && {
        dueDate: {
          ...(input.dueDateFrom && { gte: input.dueDateFrom }),
          ...(input.dueDateTo && { lte: input.dueDateTo }),
        },
      }),
      ...(isMember
        ? {
            OR: [
              { createdBy: context.user.id },
              {
                participants: {
                  some: { userId: context.user.id },
                },
              },
            ],
          }
        : {}),
    };

    const [result, doneGroups, overdueGroups] = await Promise.all([
      prisma.workspaceColumn.findMany({
        where: {
          workspaceId: input.workspaceId,
        },
        orderBy: {
          order: "asc",
        },
        select: {
          id: true,
          name: true,
          color: true,
          order: true,
          workspaceId: true,
          _count: {
            select: {
              actions: { where: visibleActions },
            },
          },
        },
      }),
      prisma.action.groupBy({
        by: ["columnId"],
        where: { AND: [visibleActions, { workspaceId: input.workspaceId, isDone: true }] },
        _count: { _all: true },
      }),
      // Atrasada = prazo antes de hoje (dia de Brasília) e ainda não concluída.
      prisma.action.groupBy({
        by: ["columnId"],
        where: {
          AND: [
            visibleActions,
            { workspaceId: input.workspaceId, isDone: false, dueDate: { lt: startOfBrazilToday() } },
          ],
        },
        _count: { _all: true },
      }),
    ]);

    const doneByColumn = new Map(doneGroups.map((group) => [group.columnId, group._count._all]));
    const overdueByColumn = new Map(overdueGroups.map((group) => [group.columnId, group._count._all]));

    const columns = result.map((column) => ({
      ...column,
      actionsCount: column._count.actions,
      doneCount: doneByColumn.get(column.id) ?? 0,
      overdueCount: overdueByColumn.get(column.id) ?? 0,
    }));

    return {
      columns,
    };
  });
