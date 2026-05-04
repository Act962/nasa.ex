import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { debitStars } from "@/lib/star-service";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { IntegrationPlatform, NasaPlannerPostStatus, StarTransactionType } from "@/generated/prisma/enums";
import { STARS_PUBLISH } from "./_helpers/ai-provider";
import { getPublicMediaUrl } from "@/lib/r2-url";
import {
  publishInstagramImage,
  publishInstagramCarousel,
  publishFacebookPagePhoto,
} from "@/http/meta/publish-feed-post";
import { publishInstagramReel } from "@/http/meta/publish-reel";

type MetaPage = { id: string; name?: string; access_token?: string };
type MetaIgAccount = { id: string; username?: string; page_id?: string };
type MetaConfig = {
  // Multi-conta (novo OAuth)
  pages?: MetaPage[];
  igAccounts?: MetaIgAccount[];
  // Legacy (paste manual)
  page_access_token?: string;
  page_id?: string;
  instagram_account_id?: string;
};

function resolveIgTarget(cfg: MetaConfig, igAccountId: string | null) {
  if (igAccountId) {
    const ig = (cfg.igAccounts ?? []).find((a) => a.id === igAccountId);
    if (!ig) return null;
    const page = (cfg.pages ?? []).find((p) => p.id === ig.page_id);
    const token = page?.access_token ?? cfg.page_access_token;
    if (!token) return null;
    return { instagramAccountId: ig.id, accessToken: token };
  }
  if (cfg.instagram_account_id && cfg.page_access_token) {
    return { instagramAccountId: cfg.instagram_account_id, accessToken: cfg.page_access_token };
  }
  return null;
}

function resolveFbTarget(cfg: MetaConfig, pageId: string | null) {
  if (pageId) {
    const page = (cfg.pages ?? []).find((p) => p.id === pageId);
    const token = page?.access_token ?? cfg.page_access_token;
    if (!page || !token) return null;
    return { pageId: page.id, accessToken: token };
  }
  if (cfg.page_id && cfg.page_access_token) {
    return { pageId: cfg.page_id, accessToken: cfg.page_access_token };
  }
  return null;
}

export const publishPost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
      include: { slides: { orderBy: { order: "asc" } } },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    const allowedStatuses: string[] = [
      NasaPlannerPostStatus.APPROVED,
      NasaPlannerPostStatus.SCHEDULED,
      NasaPlannerPostStatus.DRAFT,
      NasaPlannerPostStatus.PENDING_APPROVAL,
      NasaPlannerPostStatus.FAILED,
    ];
    if (!allowedStatuses.includes(post.status)) {
      throw new ORPCError("BAD_REQUEST", { message: "Post já publicado" });
    }

    const debit = await debitStars(
      context.org.id, STARS_PUBLISH, StarTransactionType.APP_CHARGE,
      "NASA Planner — publicação de post", "nasa-planner", context.user.id,
    );
    if (!debit.success) throw new ORPCError("BAD_REQUEST", { message: "Saldo de stars insuficiente" });

    const networks = (post.targetNetworks ?? []) as string[];
    const publishResults: Record<string, string | null> = {};
    let publishError: string | null = null;

    if (networks.includes("INSTAGRAM") || networks.includes("FACEBOOK")) {
      const metaIntegration = await prisma.platformIntegration.findFirst({
        where: { organizationId: context.org.id, platform: IntegrationPlatform.META, isActive: true },
      });

      if (metaIntegration) {
        const cfg = (metaIntegration.config ?? {}) as MetaConfig;
        const caption = post.caption ?? undefined;

        try {
          if (networks.includes("INSTAGRAM")) {
            const ig = resolveIgTarget(cfg, post.targetIgAccountId);
            if (!ig) {
              publishError = "Nenhuma conta Instagram selecionada ou sem token válido";
            } else if (post.type === "REEL" && post.videoKey) {
              const videoUrl = await getPublicMediaUrl(post.videoKey);
              const thumbUrl = post.thumbnail ? await getPublicMediaUrl(post.thumbnail) : undefined;
              publishResults.instagram = await publishInstagramReel({
                accessToken: ig.accessToken,
                instagramAccountId: ig.instagramAccountId,
                videoUrl,
                caption,
                coverUrl: thumbUrl,
              });
            } else if (post.type === "CAROUSEL" && post.slides.length > 1) {
              const imageUrls = await Promise.all(
                post.slides.filter((s) => s.imageKey).map((s) => getPublicMediaUrl(s.imageKey!)),
              );
              if (imageUrls.length > 0) {
                publishResults.instagram = await publishInstagramCarousel({
                  accessToken: ig.accessToken,
                  instagramAccountId: ig.instagramAccountId,
                  imageUrls,
                  caption,
                });
              }
            } else if (post.thumbnail) {
              const imageUrl = await getPublicMediaUrl(post.thumbnail);
              publishResults.instagram = await publishInstagramImage({
                accessToken: ig.accessToken,
                instagramAccountId: ig.instagramAccountId,
                imageUrl,
                caption,
              });
            }
          }

          if (networks.includes("FACEBOOK") && post.thumbnail) {
            const fb = resolveFbTarget(cfg, post.targetFbPageId);
            if (!fb) {
              publishError = publishError ?? "Nenhuma Página do Facebook selecionada ou sem token";
            } else {
              const imageUrl = await getPublicMediaUrl(post.thumbnail);
              const result = await publishFacebookPagePhoto({
                accessToken: fb.accessToken,
                pageId: fb.pageId,
                imageUrl,
                message: caption,
              });
              publishResults.facebook = result.post_id ?? result.id;
            }
          }
        } catch (err: any) {
          console.error("[publishPost] Meta API error:", err?.message);
          publishError = err?.message ?? "Erro na publicação Meta";
        }
      }
    }

    const publishedSomewhere = !!(publishResults.instagram || publishResults.facebook);
    const finalStatus =
      publishedSomewhere || networks.length === 0
        ? NasaPlannerPostStatus.PUBLISHED
        : NasaPlannerPostStatus.FAILED;

    const updated = await prisma.nasaPlannerPost.update({
      where: { id: post.id },
      data: {
        status: finalStatus,
        ...(finalStatus === NasaPlannerPostStatus.PUBLISHED && { publishedAt: new Date() }),
        starsSpent: { increment: STARS_PUBLISH },
        publishError,
        ...(publishResults.instagram && { externalIgPostId: publishResults.instagram }),
        ...(publishResults.facebook && { externalFbPostId: publishResults.facebook }),
      },
      include: { slides: { orderBy: { order: "asc" } } },
    });

    return {
      post: updated,
      balanceAfter: debit.newBalance,
      publishResults,
      metaWarning: publishError,
    };
  });
