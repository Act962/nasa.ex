import prisma from "@/lib/prisma";
import { tool } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const createActionTool = (userId: string, orgId: string) =>
  tool({
    description:
      "Create a event with title, workspace and status. Você pode usar outros campos como data de inicio e fim, descrição, etc, mas estes não são obrigatórios. ",
    inputSchema: z.object({
      title: z.string().describe("The title of the action"),
      content: z.string().describe("The content/body/description of the note"),
      workspaceId: z.string().describe("The ID of the workspace"),
      columnId: z.string().describe("The ID of the column"),
    }),
    execute: async ({ title, content, workspaceId, columnId }) => {
      console.log("CREATE CREATE ACTION TOOL CALL");
      try {
        const action = await prisma.action.create({
          data: {
            user: {
              connect: {
                id: userId,
              },
            },
            // organizationId é OBRIGATÓRIO pra ação aparecer no calendário —
            // `getWorkspaceCalendar` filtra por org.
            organization: {
              connect: { id: orgId },
            },
            title: title,
            description: content,
            workspace: {
              connect: {
                id: workspaceId,
              },
            },
            column: {
              connect: {
                id: columnId,
              },
            },
            participants: {
              create: {
                user: {
                  connect: {
                    id: userId,
                  },
                },
              },
            },
          },
        });

        revalidatePath(`/workspaces/${workspaceId}?action-view=kanban`);
        console.log(workspaceId);

        return {
          success: true,
          message: `Action "${title}" created successfully with ID: ${action.id}`,
          noteId: action.id,
          title: action.title,
          content: action.description,
          columnId: action.columnId,
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to create note..",
          error: error instanceof Error ? error.message : "Unknow error",
        };
      }
    },
  });
