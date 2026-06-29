import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const addResponsibleToActionTool = (userId: string) =>
  tool({
    description: "Assign a user as responsible for an action.",
    inputSchema: z.object({
      actionId: z.string().describe("The ID of the action"),
      targetUserId: z.string().describe("The ID of the user to assign as responsible"),
    }),
    execute: async ({ actionId, targetUserId }) => {
      try {
        const responsible = await prisma.actionsUserResponsible.upsert({
          where: {
            actionId_userId: {
              actionId,
              userId: targetUserId,
            },
          },
          update: {},
          create: {
            actionId,
            userId: targetUserId,
          },
          include: {
            user: {
              select: { name: true }
            },
            action: {
              select: { columnId: true }
            }
          }
        });

        return {
          success: true,
          message: `User ${responsible.user.name} assigned as responsible for the action.`,
          columnId: responsible.action.columnId,
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to assign responsible user.",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  });
