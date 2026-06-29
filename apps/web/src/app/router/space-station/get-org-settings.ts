import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";

export const getOrgSettings = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/space-station/org-settings",
    summary: "Get the active organization location + station access mode",
  })
  .handler(async ({ context }) => {
    const orgId = context.session.activeOrganizationId;
    if (!orgId) return null;

    const [org, station] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          addressLine: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          latitude: true,
          longitude: true,
          geocodedAt: true,
        },
      }),
      prisma.spaceStation.findUnique({
        where: { orgId },
        select: { accessMode: true, nick: true },
      }),
    ]);

    return {
      org,
      station,
    };
  });
