import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Move workflow pra outra pasta — ou remove de qualquer pasta passando
 * `folderId: null` (workflow vira "Sem pasta").
 *
 * Validação: workflow e pasta destino precisam pertencer ao mesmo
 * tracking (evita mover workflow cross-tracking via API).
 */
export const moveWorkflow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      folderId: z.string().nullable(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
      select: { id: true, trackingId: true },
    });
    if (!workflow) {
      throw errors.NOT_FOUND({ message: "Workflow não encontrado" });
    }

    if (input.folderId) {
      const folder = await prisma.workflowFolder.findUnique({
        where: { id: input.folderId },
        select: { id: true, trackingId: true },
      });
      if (!folder) {
        throw errors.NOT_FOUND({ message: "Pasta destino não encontrada" });
      }
      if (folder.trackingId !== workflow.trackingId) {
        throw errors.BAD_REQUEST({
          message: "Pasta pertence a outro tracking — operação bloqueada",
        });
      }
    }

    await prisma.workflow.update({
      where: { id: input.workflowId },
      data: { folderId: input.folderId },
    });

    return {
      workflowId: input.workflowId,
      folderId: input.folderId,
      trackingId: workflow.trackingId,
    };
  });
