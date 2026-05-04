import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { consumeSession, getSessionByProvider } from "@/lib/oauth/session-cache";
import { z } from "zod";

const FinalizeInput = z.object({
  oauthSessionId: z.string().min(8),
  provider: z.enum(["meta", "google"]),
  selectedAdAccountIds: z.array(z.string()).default([]),
  selectedPageIds: z.array(z.string()).default([]),
  selectedIgAccountIds: z.array(z.string()).default([]),
  selectedGoogleCustomerIds: z.array(z.string()).default([]),
});

export const oauthFinalize = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(FinalizeInput)
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    const peek = getSessionByProvider(input.oauthSessionId, input.provider);
    if (!peek || peek.orgId !== orgId) {
      throw new Error("Sessão OAuth inválida ou expirada. Reinicie a conexão.");
    }

    const sess = consumeSession(input.oauthSessionId)!;

    if (sess.provider === "meta") {
      const firstAdAccount =
        input.selectedAdAccountIds[0] ??
        sess.adAccounts[0]?.account_id ??
        sess.adAccounts[0]?.id?.replace("act_", "") ??
        "";

      const firstPage = sess.pages.find((p) => input.selectedPageIds.includes(p.id));
      const pageAccessToken = firstPage?.access_token ?? "";

      const config = {
        accessToken: sess.accessToken,
        adAccountId: firstAdAccount ? (firstAdAccount.startsWith("act_") ? firstAdAccount : `act_${firstAdAccount}`) : "",
        expiresAt: sess.expiresAt,
        scopes: sess.scopes,
        userId: sess.fbUser.id,
        userName: sess.fbUser.name,
        selectedAdAccountIds: input.selectedAdAccountIds,
        selectedPageIds: input.selectedPageIds,
        selectedIgAccountIds: input.selectedIgAccountIds,
        adAccounts: sess.adAccounts,
        pages: sess.pages.map((p) => ({ id: p.id, name: p.name, category: p.category ?? null })),
        igAccounts: sess.igAccounts,
        page_access_token: pageAccessToken,
        page_id: firstPage?.id ?? "",
      };

      const integration = await prisma.platformIntegration.upsert({
        where: { organizationId_platform: { organizationId: orgId, platform: IntegrationPlatform.META } },
        update: { config: config as unknown as object, isActive: true },
        create: {
          organizationId: orgId,
          platform: IntegrationPlatform.META,
          config: config as unknown as object,
          isActive: true,
        },
      });

      if (input.selectedIgAccountIds.length > 0) {
        const firstIg = sess.igAccounts.find((ig) => input.selectedIgAccountIds.includes(ig.id));
        const igPage = firstIg ? sess.pages.find((p) => p.id === firstIg.page_id) : null;
        const igConfig = {
          access_token: igPage?.access_token ?? sess.accessToken,
          verify_token: process.env.META_WEBHOOK_VERIFY_TOKEN ?? "nasa-verify",
          instagram_account_id: firstIg?.id ?? "",
          page_id: igPage?.id ?? "",
          userName: sess.fbUser.name,
          scopes: sess.scopes,
          selectedIgAccountIds: input.selectedIgAccountIds,
        };
        await prisma.platformIntegration.upsert({
          where: { organizationId_platform: { organizationId: orgId, platform: IntegrationPlatform.INSTAGRAM } },
          update: { config: igConfig as unknown as object, isActive: true },
          create: {
            organizationId: orgId,
            platform: IntegrationPlatform.INSTAGRAM,
            config: igConfig as unknown as object,
            isActive: true,
          },
        });
      }

      return {
        success: true,
        integration: { id: integration.id, platform: integration.platform },
        summary: {
          provider: "meta" as const,
          adAccounts: input.selectedAdAccountIds.length,
          pages: input.selectedPageIds.length,
          igAccounts: input.selectedIgAccountIds.length,
        },
      };
    }

    const config = {
      accessToken: sess.accessToken,
      refreshToken: sess.refreshToken ?? null,
      expiresAt: sess.expiresAt,
      scopes: sess.scopes,
      userId: sess.googleUser.sub,
      userName: sess.googleUser.name ?? sess.googleUser.email ?? "Google",
      userEmail: sess.googleUser.email ?? null,
      selectedGoogleCustomerIds: input.selectedGoogleCustomerIds,
      adsCustomers: sess.adsCustomers,
    };

    const integration = await prisma.platformIntegration.upsert({
      where: { organizationId_platform: { organizationId: orgId, platform: IntegrationPlatform.GMAIL } },
      update: { config: config as unknown as object, isActive: true },
      create: {
        organizationId: orgId,
        platform: IntegrationPlatform.GMAIL,
        config: config as unknown as object,
        isActive: true,
      },
    });

    return {
      success: true,
      integration: { id: integration.id, platform: integration.platform },
      summary: {
        provider: "google" as const,
        googleCustomers: input.selectedGoogleCustomerIds.length,
      },
    };
  });
