import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const listColumnsByWorkspace = (userId: string, workspaceId: string) =>
  tool({
    description: "List all the columns or status  by workspace",
    inputSchema: z.object({}),
    execute: async ({ workspaceId }) => {
      try {
        const column = await prisma.workspaceColumn.findMany({
          where: {
            workspaceId: workspaceId,
          },
          select: {
            id: true,
            name: true,
            color: true,
            order: true,
          },
        });
        return column;
      } catch (error) {
        console.error(error);
        return [];
      }
    },
  });
