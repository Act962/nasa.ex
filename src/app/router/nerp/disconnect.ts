import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import { requireOrgAdmin } from "./_access";

export const disconnectNerp = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ hard: z.boolean().optional() }).optional())
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    if (input?.hard) {
      await prisma.platformIntegration.deleteMany({
        where: {
          organizationId: context.org.id,
          platform: IntegrationPlatform.NERP,
        },
      });
      return { removed: true as const };
    }

    await prisma.platformIntegration.updateMany({
      where: {
        organizationId: context.org.id,
        platform: IntegrationPlatform.NERP,
      },
      data: { isActive: false },
    });
    return { disabled: true as const };
  });
