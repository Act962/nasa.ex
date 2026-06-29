import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import type { NerpOrgConfig } from "@/http/nerp/types";

export type LoadedNerpIntegration = {
  integrationId: string;
  config: NerpOrgConfig;
};

export async function getNerpConfig(orgId: string): Promise<LoadedNerpIntegration> {
  const integration = await prisma.platformIntegration.findUnique({
    where: {
      organizationId_platform: {
        organizationId: orgId,
        platform: IntegrationPlatform.NERP,
      },
    },
    select: {
      id: true,
      isActive: true,
      config: true,
    },
  });

  if (!integration || !integration.isActive) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message: "Integração com nerp não conectada para esta organização.",
    });
  }

  const raw = integration.config as Partial<NerpOrgConfig> | null;
  if (!raw?.apiKey || !raw.secret || !raw.nerpOrgId) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message: "Credenciais da integração nerp incompletas.",
    });
  }

  return {
    integrationId: integration.id,
    config: {
      apiKey: raw.apiKey,
      secret: raw.secret,
      nerpOrgId: raw.nerpOrgId,
      baseUrl: raw.baseUrl,
      scopes: raw.scopes,
      connectedAt: raw.connectedAt,
      consentByUserId: raw.consentByUserId,
    },
  };
}
