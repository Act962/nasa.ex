import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const getBrandConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const config = await prisma.nasaPostBrandConfig.findUnique({
      where: { organizationId: context.org.id },
    });
    if (!config) return { config: null };

    // Never send the raw API key to the client — send only a masked indicator
    const { anthropicApiKey, ...safeConfig } = config;
    return {
      config: {
        ...safeConfig,
        // true = key is set; false = not configured
        hasAnthropicKey: !!anthropicApiKey,
      },
    };
  });
