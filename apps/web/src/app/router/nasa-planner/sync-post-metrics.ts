import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import { fetchInstagramInsights, fetchFacebookInsights, MetaInsightsError, type PostMetrics } from "@/http/meta/fetch-insights";

type MetaConfig = {
  page_access_token?: string;
};

export const syncPostMetrics = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });
    if (!post.externalIgPostId && !post.externalFbPostId) {
      throw new ORPCError("BAD_REQUEST", { message: "Post sem id externo — publique antes de sincronizar" });
    }

    const integration = await prisma.platformIntegration.findFirst({
      where: { organizationId: context.org.id, platform: IntegrationPlatform.META },
    });
    if (!integration?.isActive) {
      throw new ORPCError("BAD_REQUEST", { message: "Integração Meta inativa ou não configurada" });
    }
    const token = (integration.config as MetaConfig).page_access_token;
    if (!token) throw new ORPCError("BAD_REQUEST", { message: "Token Meta ausente em config" });

    const merged: PostMetrics = {};
    let errorMessage: string | null = null;

    try {
      if (post.externalIgPostId) {
        const ig = await fetchInstagramInsights(post.externalIgPostId, token);
        Object.assign(merged, ig);
      }
      if (post.externalFbPostId) {
        const fb = await fetchFacebookInsights(post.externalFbPostId, token);
        for (const k of Object.keys(fb) as (keyof PostMetrics)[]) {
          merged[k] = (merged[k] ?? 0) + (fb[k] ?? 0);
        }
      }
    } catch (e) {
      errorMessage = e instanceof MetaInsightsError ? e.message : (e as Error).message;
    }

    if (errorMessage) {
      await prisma.$transaction([
        prisma.platformIntegration.update({
          where: { id: integration.id },
          data: { lastErrorMessage: errorMessage, lastErrorAt: new Date() },
        }),
        prisma.nasaPlannerPost.update({
          where: { id: post.id },
          data: { metricsSyncError: errorMessage, metricsSyncedAt: new Date() },
        }),
      ]);
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: errorMessage });
    }

    const updated = await prisma.$transaction([
      prisma.nasaPlannerPost.update({
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
      }),
      prisma.platformIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date(), lastErrorMessage: null, lastErrorAt: null },
      }),
    ]);

    return { post: updated[0], metrics: merged };
  });
