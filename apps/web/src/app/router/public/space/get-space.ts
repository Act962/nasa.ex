import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

/**
 * Ponto de entrada da Spacehome pública.
 *
 * Retorna o shell do perfil institucional: station + org + contagens
 * agregadas. Dados pesados (organograma, posts, reviews, etc) ficam
 * em procedures específicas para carregar sob demanda.
 */
export const getSpace = base
  .use(spaceVisibilityGuard)
  .input(z.object({ nick: z.string().min(1) }))
  .handler(async ({ context }) => {
    const { organization, station, isMember, viewerId } = context;

    const [
      followersCount,
      membersCount,
      publicActionsCount,
      publicPostsCount,
      approvedReviewsCount,
      viewerFollowing,
      nasaPage,
    ] = await Promise.all([
      prisma.orgFollow.count({ where: { orgId: organization.id } }),
      prisma.member.count({ where: { organizationId: organization.id } }),
      prisma.action.count({
        where: {
          organizationId: organization.id,
          isPublic: true,
          isArchived: false,
        },
      }),
      prisma.companyPost.count({
        where: { orgId: organization.id, isPublished: true },
      }),
      prisma.companyReview.count({
        where: { orgId: organization.id, status: "APPROVED" },
      }),
      viewerId
        ? prisma.orgFollow.findFirst({
            where: { orgId: organization.id, userId: viewerId },
            select: { id: true },
          })
        : Promise.resolve(null),
      organization.nasaPageId
        ? prisma.nasaPage.findUnique({
            where: { id: organization.nasaPageId },
            select: {
              id: true,
              slug: true,
              status: true,
              publishedLayout: true,
              layout: true,
            },
          })
        : Promise.resolve(null),
    ]);

    return {
      org: organization,
      station,
      nasaPage,
      counts: {
        followers: followersCount,
        members: membersCount,
        publicActions: publicActionsCount,
        publicPosts: publicPostsCount,
        approvedReviews: approvedReviewsCount,
        starsReceived: station.starsReceived,
      },
      viewer: {
        isMember,
        isFollowing: !!viewerFollowing,
        isAuthenticated: !!viewerId,
      },
    };
  });
