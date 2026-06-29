import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const updateActionTool = (userId: string) =>
  tool({
    description: "Update an existing action/task with new details like title, description, due date, or priority.",
    inputSchema: z.object({
      actionId: z.string().describe("The ID of the action to update"),
      title: z.string().optional().describe("New title for the action"),
      description: z.string().optional().describe("New description for the action"),
      dueDate: z.string().optional().describe("New due date in ISO format"),
      priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional().describe("New priority level"),
    }),
    execute: async ({ actionId, title, description, dueDate, priority }) => {
      try {
        const updatedAction = await prisma.action.update({
          where: { id: actionId },
          data: {
            ...(title && { title }),
            ...(description && { description }),
            ...(dueDate && { dueDate: new Date(dueDate) }),
            ...(priority && { priority }),
          },
        });

        return {
          success: true,
          message: `Action "${updatedAction.title}" updated successfully.`,
          columnId: updatedAction.columnId,
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to update action.",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  });
