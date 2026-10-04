import "server-only";
import prisma from "@/lib/prisma";
import { getPublicMediaUrl } from "@/lib/r2-url";
import { IntegrationPlatform, MetaPublishAccountKind, MetaPublishAccountStatus } from "@/generated/prisma/enums";
import { decryptSecret } from "@/lib/crypto";
import type { IgContainerParams } from "@/http/meta/planner-graph";
import { validatePostForPublishing } from "./validate-post";

/**
 * Monta o plano de publicação de um post (spec 0057): para onde vai e com qual mídia.
 * O plano é gravado no histórico do Inngest, então **nunca** leva token — cada passo busca o seu.
 */

export type PublishTarget =
  | { source: "account"; accountId: string; externalTargetId: string }
  | { source: "legacy"; externalTargetId: string };

export type IgMediaPlan =
  | { kind: "IMAGE"; imageUrl: string }
  | { kind: "CAROUSEL"; items: Array<{ imageUrl?: string; videoUrl?: string }> }
  | { kind: "REELS"; videoUrl: string; coverUrl?: string }
  | { kind: "STORIES"; imageUrl?: string; videoUrl?: string };

export type FbMediaPlan =
  | { kind: "PHOTO"; imageUrl: string }
  | { kind: "REEL"; videoUrl: string }
  | { kind: "PHOTO_STORY"; imageUrl: string }
  | { kind: "VIDEO_STORY"; videoUrl: string };

export interface PublishPlan {
  organizationId: string;
  /** Opcional: o plano atravessa o step do Inngest (JSON), onde `undefined` some. */
  caption?: string;
  instagram: { target: PublishTarget; media: IgMediaPlan; needsProcessing: boolean } | null;
  facebook: { target: PublishTarget; media: FbMediaPlan } | null;
  alreadyPublished: { instagram: boolean; facebook: boolean };
  requestedNetworks: string[];
  problems: string[];
}

type LegacyMetaConfig = {
  page_access_token?: string;
  page_id?: string;
  instagram_account_id?: string;
};

async function readLegacyMetaConfig(organizationId: string): Promise<LegacyMetaConfig | null> {
  const integration = await prisma.platformIntegration.findFirst({
    where: { organizationId, platform: IntegrationPlatform.META, isActive: true },
    select: { config: true },
  });
  return (integration?.config as LegacyMetaConfig | null) ?? null;
}

async function resolveTarget(
  organizationId: string,
  kind: MetaPublishAccountKind,
  requestedExternalId: string | null,
): Promise<PublishTarget | null> {
  const isInstagram = kind === MetaPublishAccountKind.IG_BUSINESS;
  const candidates = await prisma.metaPublishAccount.findMany({
    where: { organizationId, kind, status: MetaPublishAccountStatus.ACTIVE },
    select: { id: true, igUserId: true, pageId: true },
  });
  const externalIdOf = (candidate: (typeof candidates)[number]) => (isInstagram ? candidate.igUserId : candidate.pageId);
  const chosen = requestedExternalId
    ? candidates.find((candidate) => externalIdOf(candidate) === requestedExternalId)
    : candidates.length === 1
      ? candidates[0]
      : undefined;
  if (chosen && externalIdOf(chosen)) {
    return { source: "account", accountId: chosen.id, externalTargetId: externalIdOf(chosen)! };
  }

  // Org conectada antes da spec 0057, sem contas cadastradas: usa o config antigo (CB-5).
  if (candidates.length > 0) return null;
  const legacyConfig = await readLegacyMetaConfig(organizationId);
  const legacyExternalId = isInstagram ? legacyConfig?.instagram_account_id : legacyConfig?.page_id;
  if (!legacyConfig?.page_access_token || !legacyExternalId) return null;
  if (requestedExternalId && requestedExternalId !== legacyExternalId) return null;
  return { source: "legacy", externalTargetId: legacyExternalId };
}

/** Busca o token do destino dentro do passo que vai usá-lo. */
export async function loadTargetToken(organizationId: string, target: PublishTarget): Promise<string> {
  if (target.source === "account") {
    const account = await prisma.metaPublishAccount.findUniqueOrThrow({
      where: { id: target.accountId },
      select: { accessTokenEnc: true },
    });
    return decryptSecret(account.accessTokenEnc);
  }
  const legacyConfig = await readLegacyMetaConfig(organizationId);
  if (!legacyConfig?.page_access_token) throw new Error("Conexão antiga da Meta sem token. Reconecte nos Satélites.");
  return legacyConfig.page_access_token;
}

export async function buildPublishPlan(postId: string): Promise<PublishPlan> {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({
    where: { id: postId },
    include: { slides: { orderBy: { order: "asc" }, select: { imageKey: true, videoKey: true } } },
  });
  const requestedNetworks = post.targetNetworks ?? [];
  const problems = validatePostForPublishing({ ...post, targetNetworks: requestedNetworks });
  const caption = [post.caption, post.hashtags.map((hashtag) => `#${hashtag.replace(/^#/, "")}`).join(" ")]
    .filter(Boolean)
    .join("\n\n") || undefined;
  const plan: PublishPlan = {
    organizationId: post.organizationId,
    caption,
    instagram: null,
    facebook: null,
    alreadyPublished: { instagram: Boolean(post.externalIgPostId), facebook: Boolean(post.externalFbPostId) },
    requestedNetworks,
    problems,
  };
  if (problems.length > 0) return plan;

  if (requestedNetworks.includes("INSTAGRAM") && !post.externalIgPostId) {
    const target = await resolveTarget(post.organizationId, MetaPublishAccountKind.IG_BUSINESS, post.targetIgAccountId);
    if (!target) {
      problems.push("Nenhuma conta do Instagram conectada para este cliente. Conecte nos Satélites.");
    } else {
      const media = await buildInstagramMedia(post.type, post.thumbnail, post.videoKey, post.slides);
      const needsProcessing = media.kind === "REELS" || (media.kind === "STORIES" && Boolean(media.videoUrl))
        || (media.kind === "CAROUSEL" && media.items.some((item) => item.videoUrl));
      plan.instagram = { target, media, needsProcessing };
    }
  }

  if (requestedNetworks.includes("FACEBOOK") && !post.externalFbPostId) {
    const target = await resolveTarget(post.organizationId, MetaPublishAccountKind.FB_PAGE, post.targetFbPageId);
    const media = await buildFacebookMedia(post.type, post.thumbnail, post.videoKey, post.slides);
    if (!target) problems.push("Nenhuma página do Facebook conectada para este cliente. Conecte nos Satélites.");
    else if (!media) problems.push("O post no Facebook precisa de uma imagem ou de um vídeo.");
    else plan.facebook = { target, media };
  }
  return plan;
}

async function buildInstagramMedia(
  type: string,
  thumbnail: string | null,
  videoKey: string | null,
  slides: Array<{ imageKey: string | null; videoKey: string | null }>,
): Promise<IgMediaPlan> {
  if (type === "REEL" && videoKey) {
    return { kind: "REELS", videoUrl: await getPublicMediaUrl(videoKey), coverUrl: thumbnail ? await getPublicMediaUrl(thumbnail) : undefined };
  }
  if (type === "STORY") {
    const storyVideoKey = videoKey ?? slides.find((slide) => slide.videoKey)?.videoKey ?? null;
    if (storyVideoKey) return { kind: "STORIES", videoUrl: await getPublicMediaUrl(storyVideoKey) };
    const storyImageKey = thumbnail ?? slides.find((slide) => slide.imageKey)?.imageKey ?? null;
    return { kind: "STORIES", imageUrl: storyImageKey ? await getPublicMediaUrl(storyImageKey) : undefined };
  }
  if (type === "CAROUSEL") {
    const items = await Promise.all(
      slides
        .filter((slide) => slide.imageKey || slide.videoKey)
        .map(async (slide) =>
          slide.videoKey ? { videoUrl: await getPublicMediaUrl(slide.videoKey) } : { imageUrl: await getPublicMediaUrl(slide.imageKey!) },
        ),
    );
    return { kind: "CAROUSEL", items };
  }
  return { kind: "IMAGE", imageUrl: await getPublicMediaUrl(thumbnail!) };
}

async function buildFacebookMedia(
  type: string,
  thumbnail: string | null,
  videoKey: string | null,
  slides: Array<{ imageKey: string | null; videoKey: string | null }>,
): Promise<FbMediaPlan | null> {
  const anyVideoKey = videoKey ?? slides.find((slide) => slide.videoKey)?.videoKey ?? null;
  const anyImageKey = thumbnail ?? slides.find((slide) => slide.imageKey)?.imageKey ?? null;
  if (type === "REEL") return anyVideoKey ? { kind: "REEL", videoUrl: await getPublicMediaUrl(anyVideoKey) } : null;
  if (type === "STORY") {
    if (anyVideoKey) return { kind: "VIDEO_STORY", videoUrl: await getPublicMediaUrl(anyVideoKey) };
    return anyImageKey ? { kind: "PHOTO_STORY", imageUrl: await getPublicMediaUrl(anyImageKey) } : null;
  }
  // Carrossel no Facebook sai como foto única (a primeira), igual ao comportamento anterior.
  return anyImageKey ? { kind: "PHOTO", imageUrl: await getPublicMediaUrl(anyImageKey) } : null;
}

export function toContainerParams(media: IgMediaPlan, caption: string | undefined): IgContainerParams {
  switch (media.kind) {
    case "IMAGE":
      return { kind: "IMAGE", imageUrl: media.imageUrl, caption };
    case "REELS":
      return { kind: "REELS", videoUrl: media.videoUrl, coverUrl: media.coverUrl, caption };
    case "STORIES":
      return { kind: "STORIES", imageUrl: media.imageUrl, videoUrl: media.videoUrl };
    case "CAROUSEL":
      throw new Error("Carrossel é montado item a item");
  }
}
