import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateOrgProject = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      projectId: z.string(),
      name: z.string().optional(),
      type: z.string().optional(),
      description: z.string().nullable().optional(),
      avatar: z.string().nullable().optional(),
      color: z.string().optional(),
      isActive: z.boolean().optional(),
      isPublicOnSpace: z.boolean().optional(),   // toggle "exibir na Spacehome"
    }),
  )
  .handler(async ({ input, context }) => {
    const { projectId, ...rest } = input;
    const existing = await prisma.orgProject.findFirst({ where: { id: projectId, organizationId: context.org.id } });
    if (!existing) throw new Error("Projeto não encontrado.");
    const project = await prisma.orgProject.update({ where: { id: projectId }, data: rest });
    return { project };
  });
