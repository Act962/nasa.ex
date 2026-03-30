import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createPlanner = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().min(1, "Nome é obrigatório"),
      description: z.string().optional(),
      brandName: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const planner = await prisma.nasaPlanner.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        description: input.description,
        brandName: input.brandName,
      },
    });

    return { planner };
  });
