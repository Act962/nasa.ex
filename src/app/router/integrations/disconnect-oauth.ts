import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { revokeMetaToken } from "@/lib/oauth/meta-config";
import { revokeGoogleToken } from "@/lib/oauth/google-config";
import { z } from "zod";

const DisconnectInput = z.object({
  provider: z.enum(["meta", "google"]),
});

export const disconnectOAuth = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(DisconnectInput)
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    if (input.provider === "meta") {
      const platforms = [IntegrationPlatform.META, IntegrationPlatform.INSTAGRAM];
      const integrations = await prisma.platformIntegration.findMany({
        where: { organizationId: orgId, platform: { in: platforms } },
      });

      for (const integration of integrations) {
        const cfg = (integration.config ?? {}) as Record<string, unknown>;
        const token = cfg.accessToken as string | undefined;
        const fbUserId = cfg.userId as string | undefined;
        if (token && fbUserId) {
          await revokeMetaToken(token, fbUserId);
        }
        await prisma.platformIntegration.update({
          where: { id: integration.id },
          data: { isActive: false, config: {} },
        });
      }
      return { success: true, provider: "meta" as const };
    }

    const integration = await prisma.platformIntegration.findUnique({
      where: { organizationId_platform: { organizationId: orgId, platform: IntegrationPlatform.GMAIL } },
    });
    if (integration) {
      const cfg = (integration.config ?? {}) as Record<string, unknown>;
      const refresh = cfg.refreshToken as string | undefined;
      const access = cfg.accessToken as string | undefined;
      if (refresh) await revokeGoogleToken(refresh);
      else if (access) await revokeGoogleToken(access);
      await prisma.platformIntegration.update({
        where: { id: integration.id },
        data: { isActive: false, config: {} },
      });
    }
    return { success: true, provider: "google" as const };
  });
