import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const listWorkspaces = (userId: string) =>
  tool({
    description: "List all the workspaces this user is in, if requested",
    inputSchema: z.object({
      userId: z.string(),
      organizationId: z.string(),
    }),
    execute: async ({ userId, organizationId }) => {
      try {
        const workspaces = await prisma.workspace.findMany({
          where: {
            members: {
              some: {
                userId: userId,
              },
            },
            organizationId: organizationId,
          },
          select: {
            id: true,
            name: true,
          },
        });
        return workspaces;
      } catch (error) {
        console.error(error);
        return [];
      }
    },
  });
