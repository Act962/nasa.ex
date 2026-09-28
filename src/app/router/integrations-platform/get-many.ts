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
    return {
      integrations: integrations.map((integration) => {
        if (integration.platform !== "SEI") return integration;
        const config = integration.config as Record<string, unknown>;
        return {
          ...integration,
          config: {
            ...config,
            identificacaoServico: "",
            hasIdentificacaoServico: Boolean(config.identificacaoServico),
          },
        };
      }),
    };
  });
