import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { IntegrationPlatform, NasaPlannerPostStatus } from "@/generated/prisma/enums";
import { getPublicMediaUrl } from "@/lib/r2-url";
import {
  publishInstagramImage,
  publishInstagramCarousel,
  publishFacebookPagePhoto,
} from "@/http/meta/publish-feed-post";
import { publishInstagramReel } from "@/http/meta/publish-reel";

type MetaConfig = {
  page_access_token?: string;
  page_id?: string;
  instagram_account_id?: string;
};

export const publishPostHandler = inngest.createFunction(
  {
    id: "nasa-planner-publish-post",
    retries: 2,
  },
  { event: "nasa-planner/publish.post" },
  async ({ event, step }) => {
    const { postId, organizationId } = event.data as {
      postId: string;
      organizationId: string;
      scheduledAt?: string;
    };

    const post = await step.run("fetch-post", async () => {
      return prisma.nasaPlannerPost.findFirst({
        where: { id: postId, organizationId },
        include: { slides: { orderBy: { order: "asc" } } },
      });
    });

    if (!post) throw new NonRetriableError("Post não encontrado");
    if (post.status === NasaPlannerPostStatus.PUBLISHED) return { skipped: true };

    // Publish to social networks
    const networks = (post.targetNetworks ?? []) as string[];
    const results: Record<string, string | null> = {};
    let publishError: string | null = null;

    if (networks.includes("INSTAGRAM") || networks.includes("FACEBOOK")) {
      const metaIntegration = await step.run("fetch-meta-integration", async () => {
        return prisma.platformIntegration.findFirst({
          where: { organizationId, platform: IntegrationPlatform.META, isActive: true },
        });
      });

      if (metaIntegration) {
        const cfg = metaIntegration.config as MetaConfig;
        const token = cfg.page_access_token;
        const pageId = cfg.page_id;
        const igId = cfg.instagram_account_id;
        const caption = post.caption ?? undefined;

        try {
          if (networks.includes("INSTAGRAM") && igId && token) {
            if (post.type === "REEL" && post.videoKey) {
              const videoUrl = await step.run("get-video-url", () => getPublicMediaUrl(post.videoKey!));
              const thumbUrl = post.thumbnail
                ? await step.run("get-thumb-url", () => getPublicMediaUrl(post.thumbnail!))
                : undefined;
              results.instagram = await step.run("publish-instagram-reel", () =>
                publishInstagramReel({ accessToken: token!, instagramAccountId: igId, videoUrl, caption, coverUrl: thumbUrl }),
              );
            } else if (post.type === "CAROUSEL" && post.slides.length > 1) {
              const imageKeys = post.slides.filter((s) => s.imageKey).map((s) => s.imageKey!);
              const imageUrls = await step.run("get-carousel-urls", () =>
                Promise.all(imageKeys.map((k) => getPublicMediaUrl(k))),
              );
              if (imageUrls.length > 0) {
                results.instagram = await step.run("publish-instagram-carousel", () =>
                  publishInstagramCarousel({ accessToken: token!, instagramAccountId: igId, imageUrls, caption }),
                );
              }
            } else if (post.thumbnail) {
              const imageUrl = await step.run("get-image-url", () => getPublicMediaUrl(post.thumbnail!));
              results.instagram = await step.run("publish-instagram-image", () =>
                publishInstagramImage({ accessToken: token!, instagramAccountId: igId, imageUrl, caption }),
              );
            }
          }

          if (networks.includes("FACEBOOK") && pageId && token && post.thumbnail) {
            const imageUrl = await step.run("get-fb-image-url", () => getPublicMediaUrl(post.thumbnail!));
            const fb = await step.run("publish-facebook", () =>
              publishFacebookPagePhoto({ accessToken: token!, pageId, imageUrl, message: caption }),
            );
            results.facebook = fb.post_id ?? fb.id;
          }
        } catch (err: any) {
          publishError = err?.message ?? "Erro na publicação Meta";
        }
      }
    }

    await step.run("update-post-status", async () => {
      await prisma.nasaPlannerPost.update({
        where: { id: postId },
        data: {
          status: publishError
            ? NasaPlannerPostStatus.FAILED
            : NasaPlannerPostStatus.PUBLISHED,
          publishedAt: publishError ? undefined : new Date(),
        },
      });
    });

    return { postId, results, publishError };
  },
);
