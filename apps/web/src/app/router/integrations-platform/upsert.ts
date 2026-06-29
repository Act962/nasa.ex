import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { IntegrationPlatform } from "@/generated/prisma/enums";

export const upsertPlatformIntegration = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      platform: z.nativeEnum(IntegrationPlatform),
      config: z.record(z.string(), z.string()),
      isActive: z.boolean().default(true),
    }),
  )
  .handler(async ({ input, context }) => {
    const integration = await prisma.platformIntegration.upsert({
      where: {
        organizationId_platform: {
          organizationId: context.org.id,
          platform: input.platform,
        },
      },
      create: {
        organizationId: context.org.id,
        platform: input.platform,
        config: input.config as Record<string, string>,
        isActive: input.isActive,
      },
      update: {
        config: input.config as Record<string, string>,
        isActive: input.isActive,
      },
    });
    return { integration };
  });
