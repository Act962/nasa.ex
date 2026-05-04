import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { IntegrationPlatform } from "@/generated/prisma/enums";

const GRAPH_API = "https://graph.facebook.com/v19.0";

// Tokens expiring within 7 days from now
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type MetaConfig = {
  page_access_token?: string;
  token_expires_at?: string;
  [key: string]: unknown;
};

export const refreshMetaTokens = inngest.createFunction(
  { id: "nasa-planner-refresh-meta-tokens", retries: 1 },
  { cron: "0 9 * * 1" }, // Every Monday at 09:00 UTC
  async ({ step }) => {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return { skipped: true, reason: "FACEBOOK_APP_ID / FACEBOOK_APP_SECRET not set" };
    }

    const soon = new Date(Date.now() + REFRESH_WINDOW_MS);

    const integrations = await step.run("fetch-meta-integrations", async () => {
      return prisma.platformIntegration.findMany({
        where: { platform: IntegrationPlatform.META, isActive: true },
      });
    });

    const results: Array<{ orgId: string; refreshed: boolean; error?: string }> = [];

    for (const integration of integrations) {
      const cfg = integration.config as MetaConfig;
      const token = cfg.page_access_token;
      const expiresAt = cfg.token_expires_at ? new Date(cfg.token_expires_at) : null;

      // Skip if token expiry is far in future
      if (expiresAt && expiresAt > soon) {
        results.push({ orgId: integration.organizationId, refreshed: false });
        continue;
      }

      if (!token) {
        results.push({ orgId: integration.organizationId, refreshed: false, error: "no token" });
        continue;
      }

      try {
        const refreshed = await step.run(`refresh-token-${integration.id}`, async () => {
          const url = `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${token}`;
          const res = await fetch(url);
          const data = await res.json();
          if (!res.ok || !data.access_token) {
            throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
          }
          return data as { access_token: string; expires_in?: number };
        });

        const newExpiry = refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000)
          : null;

        await step.run(`save-token-${integration.id}`, async () => {
          await prisma.platformIntegration.update({
            where: { id: integration.id },
            data: {
              config: {
                ...cfg,
                page_access_token: refreshed.access_token,
                ...(newExpiry && { token_expires_at: newExpiry.toISOString() }),
              },
            },
          });
        });

        results.push({ orgId: integration.organizationId, refreshed: true });
      } catch (err: any) {
        results.push({ orgId: integration.organizationId, refreshed: false, error: err?.message });
      }
    }

    return { processed: integrations.length, results };
  },
);
