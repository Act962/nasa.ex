import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createOrgProject = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().min(1, "Nome é obrigatório"),
      type: z.string().default("client"),
      description: z.string().optional(),
      avatar: z.string().optional(),
      color: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const project = await prisma.orgProject.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        type: input.type,
        description: input.description ?? null,
        avatar: input.avatar ?? null,
        color: input.color ?? null,
      },
    });
    return { project };
  });
