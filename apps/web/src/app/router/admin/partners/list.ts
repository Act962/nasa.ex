import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import { PartnerStatus, PartnerTier } from "@/generated/prisma/client";

const adminBase = base.use(requireAdminMiddleware);

const TierZ = z.enum([
  "SUITE",
  "EARTH",
  "GALAXY",
  "CONSTELLATION",
  "INFINITY",
]);
const StatusZ = z.enum(["ELIGIBLE", "ACTIVE", "SUSPENDED"]);

export const listPartners = adminBase
  .route({
    method: "GET",
    summary: "Admin — Lista parceiros",
    tags: ["Admin", "Partner"],
  })
  .input(
    z.object({
      search: z.string().optional(),
      tier: TierZ.optional(),
      status: StatusZ.optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(25),
    }),
  )
  .output(
    z.object({
      partners: z.array(
        z.object({
          id: z.string(),
          userId: z.string(),
          userName: z.string(),
          userEmail: z.string(),
          userImage: z.string().nullable(),
          status: z.string(),
          tier: z.string().nullable(),
          activeReferrals: z.number(),
          totalReferrals: z.number(),
          totalEarnedBrl: z.number(),
          totalPaidBrl: z.number(),
          activatedAt: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
      total: z.number(),
    }),
  )
  .handler(async ({ input }) => {
    const where: {
      status?: PartnerStatus;
      tier?: PartnerTier;
      user?: { OR: Array<Record<string, unknown>> };
    } = {};
    if (input.status) where.status = input.status as PartnerStatus;
    if (input.tier) where.tier = input.tier as PartnerTier;
    if (input.search) {
      where.user = {
        OR: [
          { name: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ],
      };
    }

    const [rows, total] = await Promise.all([
      prisma.partner.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: [{ tier: "desc" }, { activatedAt: "desc" }],
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
          _count: { select: { commissions: true } },
        },
      }),
      prisma.partner.count({ where }),
    ]);

    const partnerUserIds = rows.map((p) => p.userId);
    const referralCounts = await prisma.partnerReferral.groupBy({
      by: ["partnerUserId", "activityStatus"],
      where: { partnerUserId: { in: partnerUserIds } },
      _count: { _all: true },
    });

    const countByPartner = new Map<string, { active: number; total: number }>();
    for (const id of partnerUserIds)
      countByPartner.set(id, { active: 0, total: 0 });
    for (const r of referralCounts) {
      const item = countByPartner.get(r.partnerUserId)!;
      item.total += r._count._all;
      if (r.activityStatus === "ACTIVE") item.active = r._count._all;
    }

    return {
      partners: rows.map((p) => ({
        id: p.id,
        userId: p.userId,
        userName: p.user.name,
        userEmail: p.user.email,
        userImage: p.user.image ?? null,
        status: p.status,
        tier: p.tier,
        activeReferrals: countByPartner.get(p.userId)?.active ?? 0,
        totalReferrals: countByPartner.get(p.userId)?.total ?? 0,
        totalEarnedBrl: Number(p.totalEarnedBrl),
        totalPaidBrl: Number(p.totalPaidBrl),
        activatedAt: p.activatedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      total,
    };
  });
