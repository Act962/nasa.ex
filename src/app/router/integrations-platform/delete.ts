import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import { assertCanManageMetaIntegration } from "@/features/integrations/lib/meta-integration-access";

export const deletePlatformIntegration = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ platform: z.nativeEnum(IntegrationPlatform) }))
  .handler(async ({ input, context }) => {
    if (input.platform === IntegrationPlatform.META) {
      const current = await prisma.platformIntegration.findUnique({
        where: {
          organizationId_platform: { organizationId: context.org.id, platform: IntegrationPlatform.META },
        },
        select: { config: true },
      });
      await assertCanManageMetaIntegration({
        organizationId: context.org.id,
        userId: context.user.id,
        currentConfig: current?.config as Record<string, unknown> | null,
      });
    }
    await prisma.platformIntegration.deleteMany({
      where: {
        organizationId: context.org.id,
        platform: input.platform,
      },
    });
    return { ok: true };
  });
