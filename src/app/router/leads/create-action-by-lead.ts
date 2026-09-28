import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import { LeadAction, TypeAction } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import z from "zod";
import { recordLeadHistory } from "./utils/history";

export const createActionByLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Create an action attached to a lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
      title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
      description: z.string().optional(),
      type: z.enum(TypeAction).default(TypeAction.TASK),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      responsibles: z.array(z.string()).default([]),
      // Ausentes = primeiro workspace conectado ao tracking do lead e sua
      // primeira coluna. `Action.workspaceId` é obrigatório no schema, então
      // toda action nasce dentro de um quadro.
      workspaceId: z.string().optional(),
      columnId: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const lead = await prisma.lead.findFirst({
      where: {
        id: input.leadId,
        tracking: {
          organizationId: context.org.id,
          participants: { some: { userId: context.user.id } },
        },
      },
      select: { id: true, name: true, trackingId: true },
    });

    if (!lead) {
      throw errors.NOT_FOUND({
        message: "Lead não encontrado ou sem acesso",
      });
    }

    const workspace = input.workspaceId
      ? await prisma.workspace.findFirst({
          where: {
            id: input.workspaceId,
            organizationId: context.org.id,
            trackingId: lead.trackingId,
          },
          select: { id: true },
        })
      : await prisma.workspace.findFirst({
          where: {
            organizationId: context.org.id,
            trackingId: lead.trackingId,
          },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });

    if (!workspace) {
      throw errors.BAD_REQUEST({
        message:
          "Nenhum workspace conectado a este tracking. Vincule um workspace nas configurações antes de criar tarefas pelo lead.",
      });
    }

    const column = input.columnId
      ? await prisma.workspaceColumn.findFirst({
          where: { id: input.columnId, workspaceId: workspace.id },
          select: { id: true },
        })
      : await prisma.workspaceColumn.findFirst({
          where: { workspaceId: workspace.id },
          orderBy: { order: "asc" },
          select: { id: true },
        });

    if (!column) {
      throw errors.BAD_REQUEST({
        message: "O workspace de destino não tem colunas",
      });
    }

    const firstAction = await prisma.action.findFirst({
      where: { columnId: column.id },
      orderBy: { order: "asc" },
      select: { order: true },
    });

    const newOrder = firstAction
      ? Prisma.Decimal.sub(firstAction.order, 1)
      : new Prisma.Decimal(0);

    const result = await prisma.$transaction(async (tx) => {
      const action = await tx.action.create({
        data: {
          title: input.title,
          description: input.description,
          type: input.type,
          startDate: input.startDate,
          endDate: input.endDate,
          leadId: lead.id,
          // O tracking vem do lead, não do input: é ele que define a
          // coerência entre lead e action (ver Fase 4 do overview).
          trackingId: lead.trackingId,
          workspaceId: workspace.id,
          columnId: column.id,
          organizationId: context.org.id,
          createdBy: context.user.id,
          order: newOrder,
          responsibles: {
            create: input.responsibles.map((userId) => ({ userId })),
          },
        },
      });

      await recordLeadHistory({
        leadId: lead.id,
        userId: context.user.id,
        action: LeadAction.ACTIVE,
        notes: `Ação criada: ${input.title}`,
        tx,
      });

      return { action };
    });

    return result;
  });
