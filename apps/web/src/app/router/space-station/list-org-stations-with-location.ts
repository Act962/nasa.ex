import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Lista Space Stations do tipo ORG cujo Organization tem latitude/longitude
 * preenchidos via geocoding. Usado pelo painel "Empresas" do mundo.
 */
export const listOrgStationsWithLocation = base
  .route({
    method: "GET",
    path: "/public/space-station/empresas-map",
    summary: "List ORG stations with geo coordinates for the map directory",
  })
  .input(z.object({ search: z.string().optional() }))
  .handler(async ({ input }) => {
    const search = input.search?.trim();
    const stations = await prisma.spaceStation.findMany({
      where: {
        type: "ORG",
        isPublic: true,
        org: {
          latitude:  { not: null },
          longitude: { not: null },
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" as const } },
                  { city: { contains: search, mode: "insensitive" as const } },
                  { addressLine: { contains: search, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
      },
      select: {
        id: true,
        nick: true,
        avatarUrl: true,
        accessMode: true,
        bio: true,
        org: {
          select: {
            id: true,
            name: true,
            logo: true,
            addressLine: true,
            city: true,
            state: true,
            postalCode: true,
            country: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    return { stations };
  });
