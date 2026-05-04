import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getTrackingsReport = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      memberIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org } = context;
      const fromDate = input.from ? new Date(input.from) : undefined;
      const toDate = input.to ? new Date(input.to) : undefined;

      const dateFilter =
        fromDate || toDate
          ? {
              createdAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {};

      const memberFilter =
        input.memberIds && input.memberIds.length > 0
          ? { responsibleId: { in: input.memberIds } }
          : {};

      const trackings = await prisma.tracking.findMany({
        where: {
          organizationId: org.id,
          isArchived: false,
        },
        include: {
          orgProject: { select: { id: true, name: true } },
          participants: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          tags: { select: { id: true, name: true, color: true } },
          workflows: {
            select: { id: true, name: true, isActive: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const trackingIds = trackings.map((t) => t.id);

      const [leadGroups, leads, paymentEntries] = await Promise.all([
        prisma.lead.groupBy({
          by: ["trackingId", "currentAction"],
          where: {
            trackingId: { in: trackingIds },
            ...dateFilter,
            ...memberFilter,
          },
          _count: { id: true },
        }),
        prisma.lead.findMany({
          where: {
            trackingId: { in: trackingIds },
            ...dateFilter,
            ...memberFilter,
          },
          select: {
            id: true,
            trackingId: true,
            currentAction: true,
            createdAt: true,
            closedAt: true,
            amount: true,
            leadTags: { select: { tagId: true } },
          },
        }),
        prisma.paymentEntry.findMany({
          where: {
            organizationId: org.id,
            trackingId: { in: trackingIds },
            type: "RECEIVABLE",
            ...(fromDate || toDate
              ? {
                  competenceDate: {
                    ...(fromDate ? { gte: fromDate } : {}),
                    ...(toDate ? { lte: toDate } : {}),
                  },
                }
              : {}),
          },
          select: {
            trackingId: true,
            amount: true,
            paidAmount: true,
            status: true,
          },
        }),
      ]);

      const reports = trackings.map((tr) => {
        const trLeads = leads.filter((l) => l.trackingId === tr.id);
        const trGroups = leadGroups.filter((g) => g.trackingId === tr.id);
        const trPayments = paymentEntries.filter((p) => p.trackingId === tr.id);

        const total = trLeads.length;
        const won = trGroups.find((g) => g.currentAction === "WON")?._count.id ?? 0;
        const lost = trGroups.find((g) => g.currentAction === "LOST")?._count.id ?? 0;
        const active = trGroups.find((g) => g.currentAction === "ACTIVE")?._count.id ?? 0;
        const closed = won + lost;
        const conversionRate = closed > 0 ? (won / closed) * 100 : 0;

        const wonAmountFromLeads = trLeads
          .filter((l) => l.currentAction === "WON")
          .reduce((s, l) => s + Number(l.amount ?? 0), 0);
        const grossRevenueCents = trPayments.reduce(
          (s, p) => s + (p.paidAmount > 0 ? p.paidAmount : p.amount),
          0,
        );

        const completedDurations = trLeads
          .filter((l) => l.closedAt)
          .map((l) => Math.max(0, l.closedAt!.getTime() - l.createdAt.getTime()));
        const avgCompletionMs =
          completedDurations.length > 0
            ? completedDurations.reduce((s, x) => s + x, 0) /
              completedDurations.length
            : 0;

        const missingTag = trLeads.filter((l) => l.leadTags.length === 0).length;

        const activeAutomations = tr.workflows.filter((w) => w.isActive);

        return {
          id: tr.id,
          name: tr.name,
          orgProject: tr.orgProject,
          totals: {
            leads: total,
            won,
            lost,
            active,
            closed,
            conversionRate,
            wonAmount: wonAmountFromLeads,
            grossRevenue: grossRevenueCents,
            missingTag,
            participants: tr.participants.length,
            tags: tr.tags.length,
            automations: tr.workflows.length,
            activeAutomations: activeAutomations.length,
          },
          participants: tr.participants.map((p) => ({
            id: p.user.id,
            name: p.user.name,
            email: p.user.email,
            image: p.user.image,
          })),
          automations: tr.workflows,
          avgCompletionMs,
          createdAt: tr.createdAt,
        };
      });

      return {
        totalTrackings: trackings.length,
        trackings: reports,
      };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
