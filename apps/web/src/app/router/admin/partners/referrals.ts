import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";

const adminBase = base.use(requireAdminMiddleware);

export const listReferralsByPartner = adminBase
  .route({
    method: "GET",
    summary: "Admin — Lista empresas indicadas por parceiro",
    tags: ["Admin", "Partner"],
  })
  .input(z.object({ partnerId: z.string() }))
  .output(
    z.object({
      referrals: z.array(
        z.object({
          id: z.string(),
          organizationId: z.string(),
          organizationName: z.string(),
          activityStatus: z.string(),
          source: z.string(),
          attachedByAdminId: z.string().nullable(),
          attachedByAdminName: z.string().nullable(),
          attachedReason: z.string().nullable(),
          signedUpAt: z.string(),
          lastQualifyingActivityAt: z.string().nullable(),
          totalStarsConsumed: z.number(),
          totalPurchasedBrl: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    const partner = await prisma.partner.findUnique({
      where: { id: input.partnerId },
    });
    if (!partner) throw errors.NOT_FOUND({ message: "Parceiro não encontrado" });

    const rows = await prisma.partnerReferral.findMany({
      where: { partnerUserId: partner.userId },
      orderBy: { signedUpAt: "desc" },
      include: {
        referredOrganization: { select: { id: true, name: true } },
        attachedByAdmin: { select: { id: true, name: true } },
      },
    });

    return {
      referrals: rows.map((r) => ({
        id: r.id,
        organizationId: r.referredOrganization.id,
        organizationName: r.referredOrganization.name,
        activityStatus: r.activityStatus,
        source: r.source,
        attachedByAdminId: r.attachedByAdmin?.id ?? null,
        attachedByAdminName: r.attachedByAdmin?.name ?? null,
        attachedReason: r.attachedReason,
        signedUpAt: r.signedUpAt.toISOString(),
        lastQualifyingActivityAt:
          r.lastQualifyingActivityAt?.toISOString() ?? null,
        totalStarsConsumed: r.totalStarsConsumed,
        totalPurchasedBrl: Number(r.totalPurchasedBrl),
      })),
    };
  });
