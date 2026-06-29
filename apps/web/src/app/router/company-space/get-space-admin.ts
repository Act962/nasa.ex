import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * View admin da Spacehome. Retorna info suficiente pro botão
 * "Link Spacehome" na sidebar: nick, visibilidade, existência
 * de station e contagens de pendências (reviews/comments PENDING).
 */
export const getSpaceAdmin = base
  .use(orgAdminGuard)
  .input(z.object({ orgId: z.string().min(1) }))
  .handler(async ({ context }) => {
    const [org, station, pendingReviews, pendingComments, pendingConsents] =
      await Promise.all([
        prisma.organization.findUnique({
          where: { id: context.orgId },
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            bio: true,
            bannerUrl: true,
            website: true,
            isSpacehomePublic: true,
            spacehomeTemplate: true,
            nasaPageId: true,
          },
        }),
        prisma.spaceStation.findFirst({
          where: { orgId: context.orgId, type: "ORG" },
          select: { id: true, nick: true, bio: true, avatarUrl: true },
        }),
        prisma.companyReview.count({
          where: { orgId: context.orgId, status: "PENDING" },
        }),
        prisma.companyPostComment.count({
          where: {
            status: "PENDING",
            post: { orgId: context.orgId },
          },
        }),
        prisma.orgRole.count({
          where: { orgId: context.orgId, publicConsent: false, userId: { not: null } },
        }),
      ]);

    return {
      org,
      station,
      hasStation: !!station,
      nick: station?.nick ?? null,
      pending: {
        reviews: pendingReviews,
        comments: pendingComments,
        roleConsents: pendingConsents,
      },
    };
  });
