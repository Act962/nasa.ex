import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { z } from "zod";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";
import { sendWorkflowExecution } from "@/inngest/utils";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import {
  recordLeadEvent,
  notifyInternalLeadChannel,
} from "@/features/leads/lib/history";
import { computeSlaDeadline } from "@/features/leads/lib/sla";

// 🟦 UPDATE
export const updateLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update an existing lead",
    tags: ["Leads"],
  })
  .input(
    z
      .object({
        id: z.string(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        description: z.string().optional(),
        statusId: z.string().optional(),
        responsibleId: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
        isConversation: z.boolean().optional().default(false),
        active: z.boolean().optional().default(false),
        statusFlow: z.enum(["WAITING", "ACTIVE", "FINISHED"]).optional(),
        amount: z.number().optional(),
        trackingId: z.string().optional(),
        orgProjectId: z.string().nullable().optional(),
      })
      .refine(
        (v) =>
          v.name !== undefined ||
          v.phone !== undefined ||
          v.email !== undefined ||
          v.description !== undefined ||
          v.statusId !== undefined ||
          v.responsibleId !== undefined ||
          v.trackingId !== undefined ||
          v.tagIds !== undefined ||
          v.active !== undefined ||
          v.statusFlow !== undefined ||
          v.amount !== undefined ||
          v.orgProjectId !== undefined,
        {
          message: "No fields to update",
          path: ["id"],
        },
      ),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const leadExists = await prisma.lead.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          statusId: true,
          trackingId: true,
          responsibleId: true,
          isActive: true,
        },
      });

      if (!leadExists) {
        throw errors.NOT_FOUND;
      }

      const isStatusChange =
        !!input.statusId && input.statusId !== leadExists.statusId;
      const isResponsibleChange =
        !!input.responsibleId && input.responsibleId !== leadExists.responsibleId;
      const now = new Date();

      const result = await prisma.$transaction(async (tx) => {
        // Recompute SLA deadline when status changes
        let slaPatch: { statusEnteredAt?: Date | null; slaDeadline?: Date | null } = {};
        if (input.statusId && input.statusId !== leadExists.statusId) {
          const newStatus = await tx.status.findUnique({
            where: { id: input.statusId },
            // slaHours só existe no client após `prisma generate` rodar
            select: { id: true, slaHours: true } as unknown as { id: true; slaHours: true },
          });
          const enteredAt = new Date();
          slaPatch = {
            statusEnteredAt: enteredAt,
            slaDeadline: computeSlaDeadline(
              newStatus as unknown as { slaHours?: number | null } | null,
              enteredAt,
            ),
          };
        }

        const lead = await tx.lead.update({
          where: { id: input.id },
          data: {
            name: input.name,
            phone: input.phone,
            email: input.email,
            description: input.description,
            statusId: input.statusId,
            trackingId: input.trackingId,
            orgProjectId: input.orgProjectId,
            responsibleId: input.responsibleId,
            isActive: input.active,
            amount: input.amount,
            ...(isStatusChange ? { lastStatusChangeAt: now } : {}),
            ...(isResponsibleChange ? { assignedAt: now } : {}),
            ...(input.statusFlow ? { statusFlow: input.statusFlow as any } : {}),
            ...(slaPatch as any),
            leadTags: input.tagIds
              ? {
                  deleteMany: {},
                  create: input.tagIds.map((tagId) => ({
                    tagId,
                  })),
                }
              : undefined,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            description: true,
            statusId: true,
            trackingId: true,
            createdAt: true,
            updatedAt: true,
            isActive: true,
            responsibleId: true,
          },
        });

        await recordLeadHistory({
          leadId: lead.id,
          userId: context.user.id,
          action: LeadAction.ACTIVE,
          notes: "Lead atualizado",
          tx,
        });

        // Eventos granulares para a Jornada
        if (input.statusId && input.statusId !== leadExists.statusId) {
          await recordLeadEvent(
            {
              leadId: lead.id,
              eventType: "STATUS_CHANGE",
              userId: context.user.id,
              previousStatusId: leadExists.statusId,
              newStatusId: input.statusId,
            },
            tx,
          );
        }
        if (input.trackingId && input.trackingId !== leadExists.trackingId) {
          await recordLeadEvent(
            {
              leadId: lead.id,
              eventType: "TRACKING_CHANGE",
              userId: context.user.id,
              previousTrackingId: leadExists.trackingId,
              newTrackingId: input.trackingId,
            },
            tx,
          );
        }
        if (
          input.responsibleId !== undefined &&
          input.responsibleId !== leadExists.responsibleId
        ) {
          await recordLeadEvent(
            {
              leadId: lead.id,
              eventType: "RESPONSIBLE_CHANGE",
              userId: context.user.id,
              previousResponsibleId: leadExists.responsibleId,
              newResponsibleId: input.responsibleId ?? null,
            },
            tx,
          );
        }

        // Workflows: ACUMULA disparos de tag + status. Antes, o branch de
        // `statusId` sobrescrevia o array de tagIds — se o user mudasse
        // tag E status no mesmo update, só os workflows de status rodavam.
        // Cada lookup é try/catch porque `data.path` em JSON pode falhar em
        // versões antigas do Prisma; falha aqui NÃO deve quebrar o update
        // do lead.
        const workflows: { id: string }[] = [];
        if (input.tagIds && input.tagIds.length > 0) {
          try {
            const tagWorkflows = await tx.workflow.findMany({
              where: {
                trackingId: lead.trackingId,
                nodes: {
                  some: {
                    type: "LEAD_TAGGED",
                    data: {
                      path: ["action", "tagIds"],
                      array_contains: input.tagIds,
                    },
                  },
                },
              },
              select: { id: true },
            });
            workflows.push(...tagWorkflows);
          } catch (wfErr) {
            console.warn("[leads/update] tag workflows lookup failed", wfErr);
          }
        }

        if (input.statusId) {
          try {
            const statusWorkflows = await tx.workflow.findMany({
              where: {
                trackingId: lead.trackingId,
                nodes: {
                  some: {
                    type: "MOVE_LEAD_STATUS",
                    data: {
                      path: ["action", "statusId"],
                      equals: input.statusId,
                    },
                  },
                },
              },
              select: { id: true },
            });
            workflows.push(...statusWorkflows);
          } catch (wfErr) {
            console.warn("[leads/update] status workflows lookup failed", wfErr);
          }
        }

        return { lead, workflows };
      });

      if (result.workflows && result.workflows.length > 0) {
        await Promise.all(
          result.workflows.map((workflow) =>
            sendWorkflowExecution({
              workflowId: workflow.id,
              initialData: {
                lead: result.lead,
                previousLead: leadExists,
              },
            }),
          ),
        );
      }

      if (isStatusChange) {
        await trackLeadEvent({
          leadId: result.lead.id,
          kind: "status_changed",
          actorId: context.user.id,
          metadata: {
            from: leadExists.statusId,
            to: input.statusId,
          },
        });
      }
      if (isResponsibleChange) {
        await trackLeadEvent({
          leadId: result.lead.id,
          kind: "lead_assigned",
          actorId: context.user.id,
          metadata: {
            from: leadExists.responsibleId,
            to: input.responsibleId,
          },
        });
      }
      if (input.tagIds && input.tagIds.length > 0) {
        await trackLeadEvent({
          leadId: result.lead.id,
          kind: "tag_added",
          actorId: context.user.id,
          metadata: { tagIds: input.tagIds },
        });
      }

      // Canal interno sempre — `recordLeadEvent` cobre status/tracking/
      // responsible. Aqui garantimos que tag_added e qualquer outro update
      // (name, phone, email, amount, etc) também propaguem em tempo real
      // pra "Detalhes do lead" do consultor.
      await notifyInternalLeadChannel(result.lead.id, "lead_updated");

      // Log activity for meaningful changes only
      const tracking = await prisma.tracking.findUnique({
        where: { id: result.lead.trackingId },
        select: { organizationId: true, name: true },
      });
      if (tracking) {
        let actionLabel = "";
        let featureKey = "lead.updated";
        const changedFields: string[] = [];
        if (input.statusId && input.statusId !== leadExists.statusId) {
          const newStatus = await prisma.status.findUnique({ where: { id: input.statusId }, select: { name: true } });
          actionLabel = `Moveu o lead "${result.lead.name}" para a coluna "${newStatus?.name ?? input.statusId}"`;
          featureKey = "lead.moved";
        } else if (input.name && input.name !== leadExists.name) {
          actionLabel = `Renomeou o lead de "${leadExists.name}" para "${input.name}"`;
          featureKey = "lead.field.updated";
          changedFields.push("name");
        } else if (input.phone && input.phone !== leadExists.phone) {
          actionLabel = `Atualizou o telefone de "${result.lead.name}"`;
          featureKey = "lead.field.updated";
          changedFields.push("phone");
        } else if (input.email && input.email !== leadExists.email) {
          actionLabel = `Atualizou o e-mail de "${result.lead.name}"`;
          featureKey = "lead.field.updated";
          changedFields.push("email");
        } else if (input.active !== undefined && input.active !== leadExists.isActive) {
          actionLabel = input.active ? `Ativou o lead "${result.lead.name}"` : `Arquivou o lead "${result.lead.name}"`;
          featureKey = input.active ? "lead.activated" : "lead.archived";
        } else if (input.amount !== undefined) {
          actionLabel = `Atualizou o valor do lead "${result.lead.name}"`;
          featureKey = "lead.field.updated";
          changedFields.push("amount");
        } else if (input.tagIds) {
          actionLabel = `Atualizou tags do lead "${result.lead.name}"`;
          featureKey = "lead.tag.updated";
        } else if (input.responsibleId && input.responsibleId !== leadExists.responsibleId) {
          actionLabel = `Trocou o responsável do lead "${result.lead.name}"`;
          featureKey = "lead.responsible.changed";
        } else {
          actionLabel = `Atualizou o lead "${result.lead.name}"`;
        }
        await logActivity({
          organizationId: tracking.organizationId,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          userImage: (context.user as any).image,
          appSlug: "tracking",
          subAppSlug: "tracking-pipeline",
          featureKey,
          action: featureKey === "lead.moved" ? "lead.moved" : "lead.updated",
          actionLabel,
          resource: result.lead.name,
          resourceId: result.lead.id,
          metadata: { trackingName: tracking.name, changedFields, fromStatusId: leadExists.statusId, toStatusId: input.statusId },
        });
      }

      return result;
    } catch (err) {
      // Loga COM contexto pra investigação posterior. O erro genérico
      // "INTERNAL_SERVER_ERROR" no client escondia a causa real (foreign
      // key, coluna inexistente em drift de DB, status pertencente a
      // outro tracking etc). Repropaga mensagem específica quando seguro.
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[leads/update] failed", {
        leadId: input.id,
        trackingId: input.trackingId,
        statusId: input.statusId,
        error: msg,
      });
      // Erros conhecidos de validação/integridade — devolve mensagem
      // amigável pro user em vez de "Algo deu errado".
      if (/foreign key|constraint|not found|does not exist/i.test(msg)) {
        throw errors.BAD_REQUEST({
          message: `Não foi possível mover o lead: ${msg}`,
        });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
