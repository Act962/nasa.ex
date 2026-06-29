import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { IntegrationPlatform } from "@/generated/prisma/enums";

export const getCommentsConnectionStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const integration = await prisma.platformIntegration.findUnique({
      where: {
        organizationId_platform: {
          organizationId: context.org.id,
          platform: IntegrationPlatform.COMMENTS_APP,
        },
      },
      select: {
        id: true,
        isActive: true,
        config: true,
        lastSyncAt: true,
        lastErrorAt: true,
        lastErrorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!integration) {
      return { connected: false as const };
    }

    const cfg = (integration.config ?? {}) as Record<string, unknown>;
    return {
      connected: true as const,
      isActive: integration.isActive,
      userId: typeof cfg.userId === "string" ? cfg.userId : null,
      baseUrl: typeof cfg.baseUrl === "string" ? cfg.baseUrl : null,
      scopes: Array.isArray(cfg.scopes) ? (cfg.scopes as string[]) : [],
      connectedAt:
        typeof cfg.connectedAt === "string" ? cfg.connectedAt : null,
      consentByUserId:
        typeof cfg.consentByUserId === "string" ? cfg.consentByUserId : null,
      lastSyncAt: integration.lastSyncAt,
      lastErrorAt: integration.lastErrorAt,
      lastErrorMessage: integration.lastErrorMessage,
    };
  });
