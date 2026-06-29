import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const moveActionToColumnTool = (userId: string) =>
  tool({
    description: "Move an action to a different column in the workspace (Kanban flow).",
    inputSchema: z.object({
      actionId: z.string().describe("The ID of the action to move"),
      columnId: z.string().describe("The ID of the target column/status"),
    }),
    execute: async ({ actionId, columnId }) => {
      try {
        const updatedAction = await prisma.action.update({
          where: { id: actionId },
          data: {
            column: {
              connect: { id: columnId },
            },
          },
          include: {
            column: true,
          },
        });

        return {
          success: true,
          message: `Action "${updatedAction.title}" moved to column "${updatedAction.column?.name}".`,
          columnId: updatedAction.columnId,
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to move action.",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  });
