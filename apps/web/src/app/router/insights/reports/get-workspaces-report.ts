import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getWorkspacesReport = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      memberIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org } = context;
      const fromDate = input.from ? new Date(input.from) : undefined;
      const toDate = input.to ? new Date(input.to) : undefined;
      const now = new Date();

      const workspaces = await prisma.workspace.findMany({
        where: {
          organizationId: org.id,
          isArchived: false,
          ...(input.memberIds && input.memberIds.length > 0
            ? { members: { some: { userId: { in: input.memberIds } } } }
            : {}),
        },
        include: {
          tracking: { select: { id: true, name: true } },
          orgProject: { select: { id: true, name: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
          tags: { select: { id: true, name: true, color: true } },
          automations: {
            select: { id: true, name: true, isActive: true },
          },
          actions: {
            select: {
              id: true,
              isDone: true,
              dueDate: true,
              closedAt: true,
              createdAt: true,
              tags: { select: { tagId: true } },
            },
          },
          _count: {
            select: {
              actions: true,
              members: true,
              tags: true,
              automations: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const reports = workspaces.map((ws) => {
        const totalActions = ws.actions.length;
        const completed = ws.actions.filter((a) => a.isDone).length;
        const overdue = ws.actions.filter(
          (a) => !a.isDone && a.dueDate !== null && a.dueDate < now,
        ).length;
        const missingTag = ws.actions.filter(
          (a) => a.tags.length === 0,
        ).length;

        const completedDurations = ws.actions
          .filter((a) => a.isDone && a.closedAt)
          .map((a) => {
            const start = a.createdAt.getTime();
            const end = a.closedAt!.getTime();
            return Math.max(0, end - start);
          });
        const avgCompletionMs =
          completedDurations.length > 0
            ? completedDurations.reduce((s, x) => s + x, 0) /
              completedDurations.length
            : 0;

        const inPeriod = fromDate || toDate
          ? ws.actions.filter((a) => {
              const c = a.createdAt;
              if (fromDate && c < fromDate) return false;
              if (toDate && c > toDate) return false;
              return true;
            }).length
          : totalActions;

        const activeAutomations = ws.automations.filter((a) => a.isActive);

        return {
          id: ws.id,
          name: ws.name,
          color: ws.color,
          icon: ws.icon,
          tracking: ws.tracking,
          orgProject: ws.orgProject,
          totals: {
            actions: totalActions,
            completed,
            overdue,
            missingTag,
            inPeriod,
            participants: ws._count.members,
            tags: ws._count.tags,
            automations: ws._count.automations,
            activeAutomations: activeAutomations.length,
          },
          participants: ws.members.map((m) => ({
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            image: m.user.image,
          })),
          automations: ws.automations,
          avgCompletionMs,
          createdAt: ws.createdAt,
        };
      });

      return {
        totalWorkspaces: workspaces.length,
        workspaces: reports,
      };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
