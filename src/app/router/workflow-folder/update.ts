import { AUTOMATION_DENIAL, checkTrackingAutomationsAccess } from "@/features/workflows/server/workflow-access";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateFolder = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z
        .string()
        .min(1, "Nome da pasta é obrigatório")
        .max(100, "Nome muito longo"),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const folder = await prisma.workflowFolder.findUnique({
      where: { id: input.id },
      select: { id: true, trackingId: true },
    });
    if (!folder) {
      throw errors.NOT_FOUND({ message: "Pasta não encontrada" });
    }
    // Ser da empresa não basta: vale a permissão de Automações do papel da pessoa (spec 0092).
    const access = await checkTrackingAutomationsAccess(folder.trackingId, context.user.id, "canEdit");
    if (access === "not-found") throw errors.NOT_FOUND({ message: "Pasta não encontrada" });
    if (access === "forbidden") throw errors.FORBIDDEN({ message: AUTOMATION_DENIAL.canEdit });

    const updated = await prisma.workflowFolder.update({
      where: { id: input.id },
      data: { name: input.name.trim() },
      select: { id: true, name: true, trackingId: true },
    });

    return updated;
  });
