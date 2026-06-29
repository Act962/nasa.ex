import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { awardPoints } from "@/app/router/space-point/utils";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createCampaignEvent = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      campaignId: z.string(),
      eventType: z.enum(["TRAINING", "STRATEGIC_MEETING", "REVIEW", "KICKOFF", "PRESENTATION", "DEADLINE"]),
      title: z.string().min(1),
      description: z.string().optional(),
      scheduledAt: z.string(),
      durationMinutes: z.number().default(60),
      meetingLink: z.string().optional(),
      participants: z.array(z.any()).optional(),
      // Workspace card
      workspaceId: z.string().optional(),
      columnId: z.string().optional(),
      // Agenda appointment
      reflectInAgenda: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ input, context }) => {
    const { campaignId, ...data } = input;

    const campaign = await prisma.nasaCampaignPlanner.findFirst({
      where: { id: campaignId, organizationId: context.org.id, deletedAt: null },
    });
    if (!campaign) throw new Error("Planejamento não encontrado.");

    const scheduledDate = new Date(data.scheduledAt);
    const endDate = new Date(scheduledDate.getTime() + data.durationMinutes * 60 * 1000);

    let linkedActionId: string | null = null;
    let linkedAppointmentId: string | null = null;

    // Create workspace card (Action) if workspace + column provided
    if (data.workspaceId && data.columnId) {
      try {
        const firstAction = await prisma.action.findFirst({
          where: { columnId: data.columnId, workspaceId: data.workspaceId },
          orderBy: { order: "asc" },
        });
        const newOrder = firstAction
          ? Prisma.Decimal.sub(firstAction.order, 1)
          : new Prisma.Decimal(0);

        const descParts = [];
        if (data.description) descParts.push(data.description);
        if (data.meetingLink) descParts.push(`Link da reunião: ${data.meetingLink}`);

        const action = await prisma.action.create({
          data: {
            title: data.title,
            description: descParts.length > 0 ? descParts.join("\n") : undefined,
            type: "MEETING",
            priority: "MEDIUM",
            startDate: scheduledDate,
            dueDate: endDate,
            workspaceId: data.workspaceId,
            columnId: data.columnId,
            organizationId: context.org.id,
            order: newOrder,
            createdBy: context.user.id,
            participants: { create: { userId: context.user.id } },
          },
        });
        linkedActionId = action.id;
      } catch {
        // best-effort
      }
    }

    // Create Appointment in Agenda if requested
    if (data.reflectInAgenda) {
      try {
        const agenda = await prisma.agenda.findFirst({
          where: { organizationId: context.org.id, isActive: true },
        });
        if (agenda) {
          const appointment = await prisma.appointment.create({
            data: {
              title: data.title,
              notes: data.description ?? null,
              startsAt: scheduledDate,
              endsAt: endDate,
              agendaId: agenda.id,
              userId: context.user.id,
              status: "CONFIRMED",
            },
          });
          linkedAppointmentId = appointment.id;
        }
      } catch {
        // best-effort
      }
    }

    const event = await prisma.nasaCampaignEvent.create({
      data: {
        campaignPlannerId: campaignId,
        eventType: data.eventType,
        title: data.title,
        description: data.description,
        scheduledAt: scheduledDate,
        durationMinutes: data.durationMinutes,
        meetingLink: data.meetingLink,
        participants: data.participants ?? [],
        linkedActionId,
        linkedAppointmentId,
      },
    });

    awardPoints(context.user.id, context.org.id, "create_campaign_event").catch(() => {});

    return { event, linkedActionId, linkedAppointmentId };
  });
