import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getPortal = base
  .input(z.object({ clientCode: z.string() }))
  .handler(async ({ input }) => {
    const process = await prisma.clientOnboardingProcess.findUnique({
      where: { clientPortalCode: input.clientCode },
      include: {
        orgProject: {
          select: { id: true, name: true, avatar: true, slogan: true, color: true, icp: true, positioning: true, voiceTone: true },
        },
        lead: {
          select: { id: true, name: true, email: true },
        },
        campaign: {
          select: {
            id: true,
            title: true,
            status: true,
            companyCode: true,
            startDate: true,
            endDate: true,
            color: true,
            clientName: true,
            campaignType: true,
            description: true,
            publicAccess: { select: { accessCode: true, isActive: true } },
            events: {
              select: { id: true, title: true, eventType: true, scheduledAt: true, status: true, meetingLink: true },
              orderBy: { scheduledAt: "asc" },
            },
            tasks: {
              select: { id: true, title: true, status: true, priority: true, dueDate: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        planner: { select: { id: true, name: true } },
      },
    });

    if (!process) {
      return { portal: null };
    }

    // Relatórios compartilhados da org
    const insights = await prisma.insightShares.findMany({
      where: { organizationId: process.organizationId },
      select: { id: true, name: true, token: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Arquivos/entregáveis públicos da org (tag "public")
    const deliverables = await prisma.nBoxItem.findMany({
      where: { organizationId: process.organizationId, tags: { has: "public" } },
      select: { id: true, name: true, type: true, url: true, mimeType: true, description: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return {
      portal: {
        clientPortalCode: process.clientPortalCode,
        stage: process.stage,
        kickoffLink: process.kickoffLink,
        paymentConfirmedAt: process.paymentConfirmedAt,
        formsSentAt: process.formsSentAt,
        brandFormDoneAt: process.brandFormDoneAt,
        onboardingDoneAt: process.onboardingDoneAt,
        campaignCreatedAt: process.campaignCreatedAt,
        activatedAt: process.activatedAt,
        brandFormId: process.brandFormId,
        onboardingFormId: process.onboardingFormId,
        orgProject: process.orgProject,
        lead: process.lead,
        campaign: process.campaign,
        planner: process.planner,
        insights,
        deliverables,
      },
    };
  });
