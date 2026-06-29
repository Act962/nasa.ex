import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const closeActionTool = (userId: string) =>
  tool({
    description: "Mark an action as completed/done.",
    inputSchema: z.object({
      actionId: z.string().describe("The ID of the action to close"),
    }),
    execute: async ({ actionId }) => {
      try {
        const closedAction = await prisma.action.update({
          where: { id: actionId },
          data: {
            isDone: true,
            closedAt: new Date(),
          },
        });

        return {
          success: true,
          message: `Action "${closedAction.title}" marked as completed.`,
          columnId: closedAction.columnId,
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to close action.",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  });
