import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getAttendantsReport = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      memberIds: z.array(z.string()).optional(),
      trackingId: z.string().optional(),
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
          ? { userId: { in: input.memberIds } }
          : {};

      const members = await prisma.member.findMany({
        where: {
          organizationId: org.id,
          ...memberFilter,
        },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });

      const memberUserIds = members.map((m) => m.userId);
      if (memberUserIds.length === 0) {
        return { totalAttendants: 0, attendants: [] };
      }

      const trackingFilter = input.trackingId
        ? { id: input.trackingId, organizationId: org.id }
        : { organizationId: org.id };

      const orgTrackings = await prisma.tracking.findMany({
        where: trackingFilter,
        select: { id: true },
      });
      const orgTrackingIds = orgTrackings.map((t) => t.id);

      const [leads, conversations, reminders] = await Promise.all([
        prisma.lead.findMany({
          where: {
            trackingId: { in: orgTrackingIds },
            responsibleId: { in: memberUserIds },
            ...dateFilter,
          },
          select: {
            id: true,
            responsibleId: true,
            currentAction: true,
            amount: true,
            createdAt: true,
            closedAt: true,
            leadTags: {
              select: {
                tag: { select: { id: true, name: true, color: true } },
              },
            },
            conversation: {
              select: {
                id: true,
                createdAt: true,
                messages: {
                  select: { fromMe: true, createdAt: true },
                  orderBy: { createdAt: "asc" },
                },
              },
            },
          },
        }),
        prisma.conversation.findMany({
          where: {
            trackingId: { in: orgTrackingIds },
            lead: { responsibleId: { in: memberUserIds } },
            ...dateFilter,
          },
          select: {
            id: true,
            lead: { select: { responsibleId: true } },
          },
        }),
        prisma.reminder.findMany({
          where: {
            isActive: true,
            createdByUserId: { in: memberUserIds },
            tracking: { organizationId: org.id },
          },
          select: { createdByUserId: true },
        }),
      ]);

      const reports = members.map((m) => {
        const userLeads = leads.filter((l) => l.responsibleId === m.userId);
        const userConvs = conversations.filter(
          (c) => c.lead.responsibleId === m.userId,
        );
        const userReminders = reminders.filter(
          (r) => r.createdByUserId === m.userId,
        );

        const total = userLeads.length;
        const won = userLeads.filter((l) => l.currentAction === "WON").length;
        const lost = userLeads.filter((l) => l.currentAction === "LOST").length;
        const active = userLeads.filter(
          (l) => l.currentAction === "ACTIVE",
        ).length;
        const closed = won + lost;
        const conversionRate = closed > 0 ? (won / closed) * 100 : 0;

        const conversationsWithReply = userLeads
          .map((l) => l.conversation)
          .filter(
            (c): c is NonNullable<typeof c> =>
              c !== null && c.messages.some((m) => m.fromMe),
          );

        const ttfrSamples = conversationsWithReply
          .map((c) => {
            const firstReply = c.messages.find((m) => m.fromMe);
            if (!firstReply) return null;
            return Math.max(0, firstReply.createdAt.getTime() - c.createdAt.getTime());
          })
          .filter((x): x is number => x !== null);
        const avgTtfrMs =
          ttfrSamples.length > 0
            ? ttfrSamples.reduce((s, x) => s + x, 0) / ttfrSamples.length
            : 0;

        const totalConvs = userConvs.length;
        const attended = conversationsWithReply.length;
        const attendanceRate =
          totalConvs > 0 ? (attended / totalConvs) * 100 : 0;

        const tagCounts = new Map<
          string,
          { id: string; name: string; color: string | null; count: number }
        >();
        for (const lead of userLeads) {
          for (const lt of lead.leadTags) {
            const existing = tagCounts.get(lt.tag.id);
            if (existing) {
              existing.count++;
            } else {
              tagCounts.set(lt.tag.id, {
                id: lt.tag.id,
                name: lt.tag.name,
                color: lt.tag.color,
                count: 1,
              });
            }
          }
        }
        const topTags = Array.from(tagCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const wonAmount = userLeads
          .filter((l) => l.currentAction === "WON")
          .reduce((s, l) => s + Number(l.amount ?? 0), 0);

        return {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
          totals: {
            leads: total,
            conversations: totalConvs,
            attended,
            attendanceRate,
            avgTtfrMs,
            won,
            lost,
            active,
            conversionRate,
            wonAmount,
            activeReminders: userReminders.length,
          },
          topTags,
        };
      });

      return {
        totalAttendants: members.length,
        attendants: reports.sort((a, b) => b.totals.leads - a.totals.leads),
      };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
