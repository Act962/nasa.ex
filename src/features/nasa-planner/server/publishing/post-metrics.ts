import "server-only";
import prisma from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { MetaPublishAccountKind } from "@/generated/prisma/enums";
import { getIgMediaMetrics, MetaGraphError, type IgMediaMetrics } from "@/http/meta/planner-graph";

/** Números reais do post publicado no Instagram, lidos na hora da Meta (tela do post publicado). */

export type PlannerPostMetrics = {
  account: { username: string | null; profilePictureUrl: string | null } | null;
  metrics: IgMediaMetrics | null;
  fetchedAt: Date;
  error: string | null;
};

export async function getPlannerPostMetrics(postId: string): Promise<PlannerPostMetrics> {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({
    where: { id: postId },
    select: { organizationId: true, type: true, externalIgPostId: true, targetIgAccountId: true },
  });
  const account = await prisma.metaPublishAccount.findFirst({
    where: {
      organizationId: post.organizationId,
      kind: MetaPublishAccountKind.IG_BUSINESS,
      ...(post.targetIgAccountId && { igUserId: post.targetIgAccountId }),
    },
    select: { igUsername: true, profilePictureUrl: true, accessTokenEnc: true },
  });
  const accountSummary = account ? { username: account.igUsername, profilePictureUrl: account.profilePictureUrl } : null;

  if (!post.externalIgPostId || !account) {
    return { account: accountSummary, metrics: null, fetchedAt: new Date(), error: post.externalIgPostId ? "Conta do Instagram não encontrada." : null };
  }

  try {
    const metrics = await getIgMediaMetrics(decryptSecret(account.accessTokenEnc), post.externalIgPostId, post.type === "STORY");
    return { account: accountSummary, metrics, fetchedAt: new Date(), error: null };
  } catch (error) {
    const message = error instanceof MetaGraphError ? error.message : "Não deu para ler os números na Meta.";
    return { account: accountSummary, metrics: null, fetchedAt: new Date(), error: message };
  }
}
