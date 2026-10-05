import "server-only";
import prisma from "@/lib/prisma";
import { ContentPublishError, type PublishedMediaMetrics } from "@/modules/social/ports/content-publisher";
import { loadInstagramPublisherForPost } from "./instagram-channels";

/** Números reais do post publicado no Instagram, lidos na hora pela conta dos Satélites (spec 0071, RF-4). */

export type PlannerPostMetrics = {
  account: { username: string | null; profilePictureUrl: string | null } | null;
  metrics: PublishedMediaMetrics | null;
  fetchedAt: Date;
  error: string | null;
};

export async function getPlannerPostMetrics(postId: string): Promise<PlannerPostMetrics> {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({
    where: { id: postId },
    select: { organizationId: true, type: true, externalIgPostId: true, targetIgAccountId: true },
  });
  const access = await loadInstagramPublisherForPost(post);
  const accountSummary = access ? { username: access.handle, profilePictureUrl: null } : null;

  if (!post.externalIgPostId || !access) {
    return { account: accountSummary, metrics: null, fetchedAt: new Date(), error: post.externalIgPostId ? "Conta do Instagram não encontrada nos Satélites." : null };
  }

  try {
    const metrics = await access.publisher.getMediaMetrics(post.externalIgPostId, post.type === "STORY");
    const isInsightsBlocked = access.canReadInsights === false && metrics.reach === null;
    return { account: accountSummary, metrics, fetchedAt: new Date(), error: isInsightsBlocked ? "Esta conta não tem permissão de métricas: alcance e visualizações ficam em branco." : null };
  } catch (error) {
    const message = error instanceof ContentPublishError ? error.message : "Não deu para ler os números na Meta.";
    return { account: accountSummary, metrics: null, fetchedAt: new Date(), error: message };
  }
}
