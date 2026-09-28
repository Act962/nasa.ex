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
          /** A imagem em si vem por `/api/admin/orgs/[id]/logo`. */
          hasLogo: z.boolean(),
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

    // Só os ids: `logo` guarda data URI base64 (há logos de 3,5 MB no banco),
    // e selecioná-la aqui colocaria megabytes na resposta de uma lista.
    const organizationIds = organizations.map((organization) => organization.id);
    const withLogo = organizationIds.length
      ? await prisma.organization.findMany({
          // Casa o que a rota consegue servir: parte das orgs tem `logo` como
          // string vazia, e marcá-las geraria uma requisição que dá 404.
          where: {
            id: { in: organizationIds },
            OR: [
              { logo: { startsWith: "data:image/" } },
              { logo: { startsWith: "http" } },
            ],
          },
          select: { id: true },
        })
      : [];
    const idsWithLogo = new Set(withLogo.map((organization) => organization.id));

    return {
      organizations: organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        hasLogo: idsWithLogo.has(organization.id),
      })),
    };
  });
