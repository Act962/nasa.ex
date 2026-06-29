import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

export const listSentReminders = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/insights/sent-reminders",
    summary:
      "List reminder occurrences that were actually sent (sent=true) within the given period, scoped to the user's organization",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
      organizationIds: z.array(z.string()).optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org, user } = context;
      const { trackingId, organizationIds, startDate, endDate, limit } = input;

      const organizationFilter = organizationIds
        ? organizationIds.length > 0
          ? { id: { in: organizationIds } }
          : {}
        : { id: org.id };

      const orgScope = {
        ...organizationFilter,
        members: { some: { userId: user.id } },
      };

      const occurrences = await prisma.reminderOccurrence.findMany({
        where: {
          sent: true,
          ...(startDate || endDate
            ? {
                sentAt: {
                  ...(startDate ? { gte: new Date(startDate) } : {}),
                  ...(endDate ? { lte: new Date(endDate) } : {}),
                },
              }
            : {}),
          reminder: {
            OR: [
              {
                tracking: {
                  organization: orgScope,
                  ...(trackingId ? { id: trackingId } : {}),
                },
              },
              {
                lead: {
                  tracking: {
                    organization: orgScope,
                    ...(trackingId ? { id: trackingId } : {}),
                  },
                },
              },
              {
                conversation: {
                  tracking: {
                    organization: orgScope,
                    ...(trackingId ? { id: trackingId } : {}),
                  },
                },
              },
              {
                action: {
                  organization: orgScope,
                },
              },
            ],
          },
        },
        orderBy: { sentAt: "desc" },
        take: limit,
        select: {
          id: true,
          sentAt: true,
          scheduledAt: true,
          reminder: {
            select: {
              id: true,
              message: true,
              notifyPhone: true,
              recurrenceType: true,
              leadId: true,
              conversationId: true,
              trackingId: true,
              actionId: true,
              lead: { select: { id: true, name: true, phone: true } },
              conversation: {
                select: {
                  id: true,
                  leadId: true,
                  lead: { select: { id: true, name: true, phone: true } },
                },
              },
              tracking: { select: { id: true, name: true } },
              action: { select: { id: true, title: true } },
              createdBy: { select: { id: true, name: true, image: true } },
            },
          },
        },
      });

      return occurrences;
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
