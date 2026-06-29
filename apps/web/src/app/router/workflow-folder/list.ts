import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista pastas de workflows do tracking, com `workflowCount` pra UI
 * decidir se mostra botão de delete (quando count === 0).
 */
export const listFolders = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const tracking = await prisma.tracking.findUnique({
      where: { id: input.trackingId },
      select: { id: true },
    });
    if (!tracking) {
      throw errors.NOT_FOUND({ message: "Tracking não encontrado" });
    }

    // Try/catch pra graceful degrade enquanto a migration
    // `workflow_folders` não foi aplicada no DB. Sem ela, a feature de
    // pastas simplesmente fica desabilitada (lista vazia) ao invés de
    // quebrar a página inteira.
    try {
      const folders = await prisma.workflowFolder.findMany({
        where: { trackingId: input.trackingId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { workflows: true } },
        },
      });

      return {
        folders: folders.map((f) => ({
          id: f.id,
          name: f.name,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
          workflowCount: f._count.workflows,
        })),
      };
    } catch (err: unknown) {
      // P2021 = table doesn't exist, P2022 = column doesn't exist
      const code =
        err instanceof Error && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === "P2021" || code === "P2022") {
        return { folders: [] };
      }
      throw err;
    }
  });
