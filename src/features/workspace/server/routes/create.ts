import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      icon: z.string().optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const members = await prisma.member.findMany({
      where: {
        organizationId: context.org.id,
      },
    });

    const workspace = await prisma.workspace.create({
      data: {
        name: input.name,
        description: input.description,
        organizationId: context.org.id,
        createdBy: context.user.id,
        icon: input.icon,
        members: {
          createMany: {
            data: members.map((member) => ({
              role: member.userId === context.user.id ? "OWNER" : "MEMBER",
              userId: member.userId,
            })),
          },
        },
        columns: {
          createMany: {
            data: [
              {
                name: "Para fazer",
                order: 0,
              },
              {
                name: "Em progresso",
                order: 1,
              },
              {
                name: "Em revisão",
                order: 2,
              },
              {
                name: "Concluído",
                order: 3,
              },
            ],
          },
        },
      },
    });

    return {
      workspace,
    };
  });
