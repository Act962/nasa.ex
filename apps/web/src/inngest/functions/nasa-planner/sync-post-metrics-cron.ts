import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { IntegrationPlatform, NasaPlannerPostStatus } from "@/generated/prisma/enums";
import { fetchInstagramInsights, fetchFacebookInsights, MetaInsightsError, type PostMetrics } from "@/http/meta/fetch-insights";

type MetaConfig = { page_access_token?: string };

export const syncPostMetricsCron = inngest.createFunction(
  { id: "nasa-planner-sync-post-metrics", retries: 1 },
  { cron: "0 * * * *" }, // hourly
  async ({ step }) => {
    const posts = await step.run("fetch-published-posts", async () => {
      return prisma.nasaPlannerPost.findMany({
        where: {
          status: NasaPlannerPostStatus.PUBLISHED,
          OR: [
            { externalIgPostId: { not: null } },
            { externalFbPostId: { not: null } },
          ],
        },
        select: {
          id: true, organizationId: true,
          externalIgPostId: true, externalFbPostId: true,
        },
      });
    });

    const integrationsByOrg = new Map<string, { id: string; token: string }>();
    const orgIds = [...new Set(posts.map((p) => p.organizationId))];

    if (orgIds.length > 0) {
      const integrations = await step.run("fetch-integrations", async () => {
        return prisma.platformIntegration.findMany({
          where: {
            organizationId: { in: orgIds },
            platform: IntegrationPlatform.META,
            isActive: true,
          },
        });
      });
      for (const i of integrations) {
        const token = (i.config as MetaConfig).page_access_token;
        if (token) integrationsByOrg.set(i.organizationId, { id: i.id, token });
      }
    }

    let synced = 0;
    let failed = 0;

    for (const post of posts) {
      const integ = integrationsByOrg.get(post.organizationId);
      if (!integ) continue;

      try {
        const merged: PostMetrics = {};
        if (post.externalIgPostId) {
          Object.assign(merged, await fetchInstagramInsights(post.externalIgPostId, integ.token));
        }
        if (post.externalFbPostId) {
          const fb = await fetchFacebookInsights(post.externalFbPostId, integ.token);
          for (const k of Object.keys(fb) as (keyof PostMetrics)[]) {
            merged[k] = (merged[k] ?? 0) + (fb[k] ?? 0);
          }
        }

        await prisma.nasaPlannerPost.update({
          where: { id: post.id },
          data: {
            metricsImpressions: merged.impressions ?? null,
            metricsReach:       merged.reach ?? null,
            metricsLikes:       merged.likes ?? null,
            metricsComments:    merged.comments ?? null,
            metricsShares:      merged.shares ?? null,
            metricsVideoViews:  merged.videoViews ?? null,
            metricsSyncedAt:    new Date(),
            metricsSyncError:   null,
          },
        });
        synced++;
      } catch (e) {
        const msg = e instanceof MetaInsightsError ? e.message : (e as Error).message;
        await prisma.$transaction([
          prisma.nasaPlannerPost.update({
            where: { id: post.id },
            data: { metricsSyncError: msg, metricsSyncedAt: new Date() },
          }),
          prisma.platformIntegration.update({
            where: { id: integ.id },
            data: { lastErrorMessage: msg, lastErrorAt: new Date() },
          }),
        ]);
        failed++;
      }
    }

    if (synced > 0 && integrationsByOrg.size > 0) {
      await prisma.platformIntegration.updateMany({
        where: { id: { in: [...integrationsByOrg.values()].map((v) => v.id) } },
        data: { lastSyncAt: new Date() },
      });
    }

    return { processed: posts.length, synced, failed };
  },
);
