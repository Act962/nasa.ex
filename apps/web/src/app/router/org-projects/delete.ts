import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteOrgProject = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ projectId: z.string() }))
  .handler(async ({ input, context }) => {
    const existing = await prisma.orgProject.findFirst({ where: { id: input.projectId, organizationId: context.org.id } });
    if (!existing) throw new Error("Projeto não encontrado.");
    // Soft delete — desativa em vez de excluir (leads/trackings mantêm referência)
    await prisma.orgProject.update({ where: { id: input.projectId }, data: { isActive: false } });
    return { success: true };
  });
