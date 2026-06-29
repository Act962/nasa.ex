import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getWorkspaceCalendar = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      startDate: z.string(),
      endDate: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    end.setHours(23, 59, 59, 999);

    const actions = await prisma.action.findMany({
      where: {
        organizationId: context.org.id,
        isArchived: false,
        AND: [
          {
            // "Ações que participo" = qualquer relação de pertencimento.
            // Antes só pegava createdBy + participants — agora cobre os 4
            // vínculos possíveis para evitar buracos no calendário.
            OR: [
              { createdBy: context.user.id },
              { participants: { some: { userId: context.user.id } } },
              { responsibles: { some: { userId: context.user.id } } },
              {
                workspace: {
                  members: { some: { userId: context.user.id } },
                },
              },
            ],
          },
          {
            OR: [
              { dueDate: { gte: start, lte: end } },
              { startDate: { gte: start, lte: end } },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        startDate: true,
        endDate: true,
        priority: true,
        isDone: true,
        coverImage: true,
        workspaceId: true,
        workspace: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            coverImage: true,
          },
        },
        // Vínculos para filtro por cliente/projeto/lead
        orgProjectId: true,
        orgProject: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            avatar: true,
          },
        },
        trackingId: true,
        tracking: { select: { id: true, name: true } },
        leadId: true,
        lead: { select: { id: true, name: true, email: true } },
        createdBy: true,
        user: { select: { id: true, name: true, image: true } },
        participants: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, image: true } },
          },
        },
        responsibles: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
      orderBy: [
        { dueDate: { sort: "asc", nulls: "last" } },
        { startDate: { sort: "asc", nulls: "last" } },
      ],
    });

    return { actions };
  });
