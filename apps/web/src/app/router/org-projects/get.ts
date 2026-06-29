import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getOrgProject = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ projectId: z.string() }))
  .handler(async ({ input, context }) => {
    const project = await prisma.orgProject.findFirst({
      where: { id: input.projectId, organizationId: context.org.id },
      include: {
        leads: { select: { id: true, name: true, email: true, phone: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 },
        trackings: { select: { id: true, name: true, isArchived: true }, orderBy: { createdAt: "desc" } },
        _count: { select: { leads: true, trackings: true, actions: true, workspaces: true, appointments: true } },
      },
    });
    if (!project) throw new Error("Projeto não encontrado.");
    return { project };
  });
