import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const getManyPlatformIntegrations = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const integrations = await prisma.platformIntegration.findMany({
      where: { organizationId: context.org.id },
      orderBy: { platform: "asc" },
    });
    return { integrations };
  });
