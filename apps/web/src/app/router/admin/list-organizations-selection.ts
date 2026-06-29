import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listOrganizationsForSelection = base
  .use(requireAdminMiddleware)
  .route({
    method: "GET",
    summary: "Admin — List organizations for selection",
    tags: ["Admin"],
  })
  .input(
    z.object({
      search: z.string().optional(),
      limit: z.number().default(50),
    }),
  )
  .output(
    z.object({
      organizations: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input }) => {
    const { search, limit } = input;

    const organizations = await prisma.organization.findMany({
      where: search
        ? {
            name: { contains: search, mode: "insensitive" },
          }
        : {},
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    });

    return {
      organizations: organizations.map((o) => ({
        id: o.id,
        name: o.name,
      })),
    };
  });
