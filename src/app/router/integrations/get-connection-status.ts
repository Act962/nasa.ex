import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { getSessionByProvider } from "@/lib/oauth/session-cache";
import { z } from "zod";

const Input = z.object({
  oauthSessionId: z.string().optional(),
});

export const getConnectionStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(Input)
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    const integrations = await prisma.platformIntegration.findMany({
      where: {
        organizationId: orgId,
        platform: { in: [IntegrationPlatform.META, IntegrationPlatform.INSTAGRAM, IntegrationPlatform.GMAIL] },
      },
    });

    const meta = integrations.find((i) => i.platform === IntegrationPlatform.META);
    const ig = integrations.find((i) => i.platform === IntegrationPlatform.INSTAGRAM);
    const gmail = integrations.find((i) => i.platform === IntegrationPlatform.GMAIL);

    const metaCfg = (meta?.config ?? {}) as Record<string, any>;
    const gmailCfg = (gmail?.config ?? {}) as Record<string, any>;

    let pendingMeta: any = null;
    let pendingGoogle: any = null;
    if (input.oauthSessionId) {
      const sMeta = getSessionByProvider(input.oauthSessionId, "meta");
      if (sMeta && sMeta.provider === "meta" && sMeta.orgId === orgId) {
        pendingMeta = {
          fbUser: sMeta.fbUser,
          pages: sMeta.pages.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category ?? null,
            hasInstagram: Boolean(p.instagram_business_account?.id),
          })),
          adAccounts: sMeta.adAccounts.map((a) => ({
            id: a.id,
            account_id: a.account_id,
            name: a.name,
            currency: a.currency ?? null,
          })),
          igAccounts: sMeta.igAccounts,
          scopes: sMeta.scopes,
        };
      }
      const sGoogle = getSessionByProvider(input.oauthSessionId, "google");
      if (sGoogle && sGoogle.provider === "google" && sGoogle.orgId === orgId) {
        pendingGoogle = {
          googleUser: sGoogle.googleUser,
          adsCustomers: sGoogle.adsCustomers,
          scopes: sGoogle.scopes,
        };
      }
    }

    return {
      meta: meta && meta.isActive
        ? {
            connected: true,
            userName: metaCfg.userName ?? null,
            scopes: (metaCfg.scopes as string[]) ?? [],
            expiresAt: metaCfg.expiresAt ?? null,
            adAccounts: (metaCfg.selectedAdAccountIds as string[]) ?? [],
            pages: (metaCfg.selectedPageIds as string[]) ?? [],
            igConnected: Boolean(ig?.isActive),
          }
        : { connected: false },
      google: gmail && gmail.isActive
        ? {
            connected: true,
            userName: gmailCfg.userName ?? null,
            userEmail: gmailCfg.userEmail ?? null,
            scopes: (gmailCfg.scopes as string[]) ?? [],
            expiresAt: gmailCfg.expiresAt ?? null,
            customers: (gmailCfg.selectedGoogleCustomerIds as string[]) ?? [],
          }
        : { connected: false },
      pendingMeta,
      pendingGoogle,
    };
  });
