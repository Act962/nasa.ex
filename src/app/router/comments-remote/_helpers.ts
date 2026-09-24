import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import type { CommentsConfig } from "@/http/comments/types";

export type LoadedCommentsIntegration = {
  integrationId: string;
  config: CommentsConfig;
};

export async function getCommentsConfig(
  orgId: string,
): Promise<LoadedCommentsIntegration> {
  const integration = await prisma.platformIntegration.findUnique({
    where: {
      organizationId_platform: {
        organizationId: orgId,
        platform: IntegrationPlatform.COMMENTS_APP,
      },
    },
    select: { id: true, isActive: true, config: true },
  });

  if (!integration || !integration.isActive) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message:
        "Integração com Comments App não conectada para esta organização.",
    });
  }

  const raw = integration.config as Partial<CommentsConfig> | null;
  if (!raw?.apiKey || !raw.secret || !raw.userId) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message: "Credenciais da integração Comments App incompletas.",
    });
  }

  return {
    integrationId: integration.id,
    config: {
      apiKey: raw.apiKey,
      secret: raw.secret,
      userId: raw.userId,
      baseUrl: raw.baseUrl,
      scopes: raw.scopes,
      connectedAt: raw.connectedAt,
      consentByUserId: raw.consentByUserId,
    },
  };
}
