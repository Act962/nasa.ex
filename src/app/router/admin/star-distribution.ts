import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

const adminBase = base.use(requireAdminMiddleware);

// ── List all orgs with their distribution mode + plan info ────────────────────

export const listOrgDistributions = adminBase
  .output(
    z.object({
      orgs: z.array(
        z.object({
          id:                   z.string(),
          name:                 z.string(),
          distributionMode:     z.string(),
          planName:             z.string().nullable(),
          planMonthlyStars:     z.number(),
          memberCount:          z.number(),
          equalShare:           z.number(),
          members: z.array(
            z.object({
              userId:        z.string(),
              userName:      z.string(),
              userEmail:     z.string(),
              role:          z.string(),
              monthlyBudget: z.number(),
              currentUsage:  z.number(),
            })
          ),
        })
      ),
    })
  )
  .handler(async () => {
    const orgs = await prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        id:                  true,
        name:                true,
        starDistributionMode: true,
        plan: { select: { name: true, monthlyStars: true } },
        members: {
          select: {
            role:   true,
            userId: true,
            user:   { select: { name: true, email: true } },
          },
        },
        memberStarBudgets: {
          select: { userId: true, monthlyBudget: true, currentUsage: true },
        },
      },
    });

    return {
      orgs: orgs.map((o) => {
        const planStars   = o.plan?.monthlyStars ?? 0;
        const memberCount = o.members.length;
        const equalShare  = memberCount > 0 ? Math.floor(planStars / memberCount) : 0;
        const budgetMap   = new Map(o.memberStarBudgets.map((b) => [b.userId, b]));

        return {
          id:               o.id,
          name:             o.name,
          distributionMode: o.starDistributionMode,
          planName:         o.plan?.name ?? null,
          planMonthlyStars: planStars,
          memberCount,
          equalShare,
          members: o.members.map((m) => {
            const bud = budgetMap.get(m.userId);
            return {
              userId:        m.userId,
              userName:      m.user.name,
              userEmail:     m.user.email,
              role:          m.role,
              monthlyBudget: bud?.monthlyBudget ?? 0,
              currentUsage:  bud?.currentUsage  ?? 0,
            };
          }),
        };
      }),
    };
  });

// ── Set distribution mode for a specific org ──────────────────────────────────

export const setOrgDistribution = adminBase
  .input(z.object({
    orgId: z.string(),
    mode:  z.enum(["org", "equal", "custom"]),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    await prisma.organization.update({
      where: { id: input.orgId },
      data:  { starDistributionMode: input.mode },
    });

    // Equal mode → auto-compute budgets
    if (input.mode === "equal") {
      const org = await prisma.organization.findUniqueOrThrow({
        where:  { id: input.orgId },
        select: {
          plan:    { select: { monthlyStars: true } },
          members: { select: { userId: true } },
        },
      });
      const share = org.members.length > 0
        ? Math.floor((org.plan?.monthlyStars ?? 0) / org.members.length)
        : 0;

      await Promise.all(
        org.members.map((m) =>
          prisma.memberStarBudget.upsert({
            where:  { organizationId_userId: { organizationId: input.orgId, userId: m.userId } },
            update: { monthlyBudget: share },
            create: {
              id:             `${input.orgId}-${m.userId}`,
              organizationId: input.orgId,
              userId:         m.userId,
              monthlyBudget:  share,
            },
          })
        )
      );
    }

    return { success: true };
  });

// ── Set budget for a single member (admin override) ───────────────────────────

export const setOrgMemberBudget = adminBase
  .input(z.object({
    orgId:         z.string(),
    userId:        z.string(),
    monthlyBudget: z.number().min(0),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    await prisma.memberStarBudget.upsert({
      where:  { organizationId_userId: { organizationId: input.orgId, userId: input.userId } },
      update: { monthlyBudget: input.monthlyBudget },
      create: {
        id:             `${input.orgId}-${input.userId}`,
        organizationId: input.orgId,
        userId:         input.userId,
        monthlyBudget:  input.monthlyBudget,
      },
    });
    return { success: true };
  });
