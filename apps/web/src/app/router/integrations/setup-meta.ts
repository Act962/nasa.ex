import { requiredAuthMiddleware } from "@/app/middlewares/auth"
import { base } from "@/app/middlewares/base"
import prisma from "@/lib/prisma"
import { IntegrationPlatform } from "@/generated/prisma/enums"
import z from "zod"

export const setupMetaIntegration = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/integrations/meta/setup",
    summary: "Setup Instagram or Facebook Messenger integration",
    tags: ["Integrations"],
  })
  .input(
    z.object({
      platform: z.enum(["INSTAGRAM", "FACEBOOK"]),
      accessToken: z.string().min(1),
      verifyToken: z.string().min(1),
      instagramAccountId: z.string().optional(),
      pageId: z.string().optional(),
      pageAccessToken: z.string().optional(),
    })
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.session.activeOrganizationId
    if (!organizationId) throw new Error("Organization not found")

    const prismaplatform =
      input.platform === "INSTAGRAM" ? IntegrationPlatform.INSTAGRAM : IntegrationPlatform.META

    const config =
      input.platform === "INSTAGRAM"
        ? {
            access_token: input.accessToken,
            verify_token: input.verifyToken,
            instagram_account_id: input.instagramAccountId ?? "",
          }
        : {
            page_access_token: input.pageAccessToken ?? input.accessToken,
            verify_token: input.verifyToken,
            page_id: input.pageId ?? "",
          }

    const integration = await prisma.platformIntegration.upsert({
      where: { organizationId_platform: { organizationId, platform: prismaplatform } },
      update: { config, isActive: true },
      create: { organizationId, platform: prismaplatform, config, isActive: true },
    })

    const webhookPath =
      input.platform === "INSTAGRAM"
        ? "/api/integrations/instagram/webhook"
        : "/api/integrations/facebook/webhook"

    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}${webhookPath}`

    return { integration, webhookUrl }
  })

export const getMetaIntegration = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/integrations/meta",
    summary: "Get Meta integrations status for the organization",
    tags: ["Integrations"],
  })
  .input(z.object({}))
  .handler(async ({ context }) => {
    const organizationId = context.session.activeOrganizationId
    if (!organizationId) throw new Error("Organization not found")

    const integrations = await prisma.platformIntegration.findMany({
      where: {
        organizationId,
        platform: { in: [IntegrationPlatform.INSTAGRAM, IntegrationPlatform.META] },
      },
      select: { platform: true, isActive: true },
    })

    return {
      instagram: integrations.find((i) => i.platform === IntegrationPlatform.INSTAGRAM) ?? null,
      facebook: integrations.find((i) => i.platform === IntegrationPlatform.META) ?? null,
    }
  })
