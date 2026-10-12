import { AUTOMATION_DENIAL, checkTrackingAutomationsAccess } from "@/features/workflows/server/workflow-access";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Deleta pasta — **bloqueia se houver workflows dentro**. Pra deletar
 * a pasta, usuário precisa primeiro mover ou deletar os workflows
 * associados. Mensagem amigável diz quantos workflows estão dentro.
 */
export const deleteFolder = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const folder = await prisma.workflowFolder.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        name: true,
        trackingId: true,
        _count: { select: { workflows: true } },
      },
    });
    if (!folder) {
      throw errors.NOT_FOUND({ message: "Pasta não encontrada" });
    }
    // Ser da empresa não basta: vale a permissão de Automações do papel da pessoa (spec 0092).
    const access = await checkTrackingAutomationsAccess(folder.trackingId, context.user.id, "canDelete");
    if (access === "not-found") throw errors.NOT_FOUND({ message: "Pasta não encontrada" });
    if (access === "forbidden") throw errors.FORBIDDEN({ message: AUTOMATION_DENIAL.canDelete });

    if (folder._count.workflows > 0) {
      throw errors.BAD_REQUEST({
        message: `Pasta "${folder.name}" contém ${folder._count.workflows} automação(ões). Mova ou exclua antes de deletar a pasta.`,
      });
    }

    await prisma.workflowFolder.delete({ where: { id: input.id } });

    return {
      id: folder.id,
      name: folder.name,
      trackingId: folder.trackingId,
    };
  });
