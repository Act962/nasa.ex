import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Deleta agente — Cascade apaga TODAS as sessões abertas dele.
 * Use com cuidado. UI deve confirmar dupla se houver sessions ativas.
 */
export const deleteAgent = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "DELETE",
    path: "/agents/:id",
    summary: "Deleta agente IA + todas suas sessões",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const { org } = context;
    const existing = await prisma.agent.findFirst({
      where: { id: input.id, organizationId: org.id },
      select: { id: true, name: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Agente não encontrado" });
    }
    await prisma.agent.delete({ where: { id: input.id } });
    return { id: existing.id, name: existing.name };
  });
