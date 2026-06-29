import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listAvailableInstances = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "List available WhatsApp instances for the org",
    tags: ["Integrations"],
  })
  .input(z.void())
  .handler(async ({ context }) => {
    const { user, org } = context;

    const instances = await prisma.whatsAppInstance.findMany({
      where: {
        organizationId: org?.id,
        isActive: true,
        tracking: {
          participants: { some: { userId: user.id } },
        },
      },
      select: {
        id: true,
        instanceName: true,
        phoneNumber: true,
        profileName: true,
        status: true,
        trackingId: true,
        tracking: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return instances.map((i) => ({
      id: i.id,
      instanceName: i.instanceName,
      phoneNumber: i.phoneNumber,
      profileName: i.profileName,
      status: i.status,
      trackingId: i.trackingId,
      trackingName: i.tracking.name,
    }));
  });
