import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

export const listMembers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/org/list",
    summary: "Listar organizações",
  })
  .input(
    z.object({
      query: z.object({
        userIds: z.array(z.string()).optional(),
      }),
    })
  )
  .output(
    z.object({
      members: z.array(
        z.object({
          id: z.string(),
          createdAt: z.date(),
          updatedAt: z.date(),
          email: z.string(),
          emailVerified: z.boolean(),
          name: z.string(),
          image: z.string().nullable(),
        })
      ),
    })
  )
  .handler(async ({ context, input }) => {
    const members = await prisma.member.findMany({
      where: {
        organizationId: context.org.id,
        userId: {
          notIn: input.query.userIds,
        },
      },
      select: {
        user: true,
      },
    });

    return {
      members: members.map((member) => ({
        ...member.user,
      })),
    };
  });
