import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { Connection, Node, Workflow } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

type WorkflowWithGraph = Workflow & {
  nodes: Node[];
  connections: Connection[];
};

export const listWorkflows = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      workflows: z.array(z.custom<WorkflowWithGraph>()),
    })
  )
  .handler(async ({ input, errors }) => {
    const trackingExists = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!trackingExists) {
      throw errors.NOT_FOUND({
        message: "Tracking não encontrado",
      });
    }

    // SELECT explícito pra evitar erro P2022 quando a migration
    // `workflow_folders` ainda não foi aplicada no DB (folder_id ausente).
    // Quando a coluna existir, basta trocar pra `include` ou adicionar
    // `folderId: true` aqui.
    const workflows = await prisma.workflow.findMany({
      where: {
        trackingId: input.trackingId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        userId: true,
        trackingId: true,
        workspaceId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Tentamos selecionar folderId. Se a coluna não existir, Prisma
        // joga P2022 — capturamos e refazemos sem folderId mais abaixo.
        folderId: true,
        nodes: true,
        connections: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }).catch(async (err: unknown) => {
      // Fallback: migration de pastas não aplicada ainda — refaz sem folderId
      const isMissingFolderColumn =
        err instanceof Error &&
        "code" in err &&
        (err as { code?: string }).code === "P2022";
      if (!isMissingFolderColumn) throw err;

      const rows = await prisma.workflow.findMany({
        where: { trackingId: input.trackingId },
        select: {
          id: true,
          name: true,
          description: true,
          userId: true,
          trackingId: true,
          workspaceId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          nodes: true,
          connections: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((w) => ({ ...w, folderId: null as string | null }));
    });

    return {
      workflows: workflows as WorkflowWithGraph[],
    };
  });
