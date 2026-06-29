import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const getOverdueActionsTool = (userId: string) =>
  tool({
    description: "Get all overdue actions (tasks that are past their due date and not completed) for a specific workspace.",
    inputSchema: z.object({
      workspaceId: z.string().describe("The ID of the workspace to check for overdue actions"),
    }),
    execute: async ({ workspaceId }) => {
      try {
        const overdueActions = await prisma.action.findMany({
          where: {
            workspaceId,
            isDone: false,
            dueDate: {
              lt: new Date(),
            },
          },
          orderBy: {
            dueDate: "asc",
          },
        });

        return {
          success: true,
          count: overdueActions.length,
          actions: overdueActions,
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to fetch overdue actions.",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  });
