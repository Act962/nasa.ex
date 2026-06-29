import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const getWorkspaceSummaryTool = (userId: string) =>
  tool({
    description: "Get a summary of the workspace, including total actions, completed ones, and distribution across columns.",
    inputSchema: z.object({
      workspaceId: z.string().describe("The ID of the workspace to summarize"),
    }),
    execute: async ({ workspaceId }) => {
      try {
        const [totalActions, completedActions, overdueActions, columns] = await Promise.all([
          prisma.action.count({ where: { workspaceId } }),
          prisma.action.count({ where: { workspaceId, isDone: true } }),
          prisma.action.count({ 
            where: { 
              workspaceId, 
              isDone: false, 
              dueDate: { lt: new Date() } 
            } 
          }),
          prisma.workspaceColumn.findMany({
            where: { workspaceId },
            include: {
              _count: {
                select: { actions: true }
              }
            },
            orderBy: { order: "asc" }
          })
        ]);

        return {
          success: true,
          summary: {
            total: totalActions,
            completed: completedActions,
            pending: totalActions - completedActions,
            overdue: overdueActions,
            columnDistribution: columns.map(c => ({
              name: c.name,
              count: c._count.actions
            }))
          }
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to get workspace summary.",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  });
