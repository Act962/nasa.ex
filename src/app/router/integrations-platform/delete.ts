import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { IntegrationPlatform } from "@/generated/prisma/enums";

export const deletePlatformIntegration = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ platform: z.nativeEnum(IntegrationPlatform) }))
  .handler(async ({ input, context }) => {
    await prisma.platformIntegration.deleteMany({
      where: {
        organizationId: context.org.id,
        platform: input.platform,
      },
    });
    return { ok: true };
  });
