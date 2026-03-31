import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getColumnsByWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string().min(1, "Workspace é obrigatório"),
    }),
  )
  .handler(async ({ input }) => {
    const result = await prisma.workspaceColumn.findMany({
      where: {
        workspaceId: input.workspaceId,
      },
      orderBy: {
        order: "asc",
      },
      select: {
        id: true,
        name: true,
        color: true,
        workspaceId: true,
        _count: {
          select: {
            actions: true,
          },
        },
      },
    });

    const columns = result.map((column) => ({
      ...column,
      actionsCount: column._count.actions,
    }));

    return {
      columns,
    };
  });
