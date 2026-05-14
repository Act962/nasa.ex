import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { z } from "zod";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";
import { trackLeadEvent } from "@/lib/lead-journey/track";

// 🟦 UPDATE
export const updateManyStatusLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update many leads status",
    tags: ["Leads"],
  })
  .input(
    z
      .object({
        leadsIds: z.array(z.string()),
        statusId: z.string().optional(),
        trackingId: z.string().optional(),
      })
      .refine(
        (v) =>
          v.statusId !== undefined ||
          v.trackingId !== undefined || {
            message: "No fields to update",
            path: ["id"],
          },
      ),
  )

  .handler(async ({ input, errors, context }) => {
    try {
      const leadExists = await prisma.lead.findMany({
        where: { id: { in: input.leadsIds } },
      });

      if (leadExists.length === 0) {
        throw errors.NOT_FOUND;
      }

      const result = await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.updateMany({
          where: { id: { in: input.leadsIds } },
          data: {
            statusId: input.statusId,
            trackingId: input.trackingId,
            ...(input.statusId ? { lastStatusChangeAt: new Date() } : {}),
          },
        });

        await Promise.all(
          input.leadsIds.map((leadId) =>
            recordLeadHistory({
              leadId,
              userId: context.user.id,
              action: LeadAction.ACTIVE,
              notes: "Status do lead atualizado em lote",
              tx,
            }),
          ),
        );

        return { lead };
      });

      // Log activity
      if (input.statusId && input.trackingId) {
        const fromStatusIds = Array.from(
          new Set(
            leadExists.map((lead) => lead.statusId).filter(Boolean) as string[],
          ),
        );
        const [tracking, newStatus, fromStatuses] = await Promise.all([
          prisma.tracking.findUnique({
            where: { id: input.trackingId },
            select: { organizationId: true, name: true },
          }),
          prisma.status.findUnique({
            where: { id: input.statusId },
            select: { name: true },
          }),
          fromStatusIds.length
            ? prisma.status.findMany({
                where: { id: { in: fromStatusIds } },
                select: { id: true, name: true },
              })
            : Promise.resolve([]),
        ]);
        if (tracking) {
          const fromStatusName = fromStatuses[0]?.name;
          await logActivity({
            organizationId: tracking.organizationId,
            userId: context.user.id,
            userName: context.user.name,
            userEmail: context.user.email,
            userImage: (context.user as any).image,
            appSlug: "tracking",
            action: "lead_stage_move",
            actionLabel:
              fromStatusName && fromStatuses.length === 1
                ? `Moveu ${input.leadsIds.length} lead(s) de "${fromStatusName}" para "${newStatus?.name ?? input.statusId}"`
                : `Moveu ${input.leadsIds.length} lead(s) para a coluna "${newStatus?.name ?? input.statusId}"`,
            subAppSlug: "tracking-pipeline",
            featureKey: "lead.dragged",
            metadata: {
              count: input.leadsIds.length,
              statusName: newStatus?.name,
              trackingName: tracking.name,
              fromStatusIds,
              fromStatusNames: fromStatuses.map((s) => s.name),
              toStatusId: input.statusId,
            },
          });

          // Cobra 1× por lead movido (regra `lead_stage_move`).
          for (let i = 0; i < input.leadsIds.length; i++) {
            await chargeStarsByAction(
              tracking.organizationId,
              "lead_stage_move",
              {
                userId: context.user.id,
                description: `Moveu lead pra "${newStatus?.name ?? input.statusId}"`,
                appSlug: "tracking",
              },
            );
          }
        }
      }

      if (input.statusId) {
        const leadStatusBefore = new Map(
          leadExists.map((lead) => [lead.id, lead.statusId]),
        );
        await Promise.all(
          input.leadsIds.map((leadId) =>
            trackLeadEvent({
              leadId,
              kind: "status_changed",
              actorId: context.user.id,
              metadata: {
                from: leadStatusBefore.get(leadId),
                to: input.statusId,
                bulk: true,
              },
            }),
          ),
        );
      }

      return result;
    } catch (err) {
      if (
        err != null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        const target =
          ((err as { meta?: { target?: string[] } }).meta?.target) ?? [];
        const isPhoneConflict =
          target.includes("phone") || target.includes("tracking_id");
        throw errors.BAD_REQUEST({
          message: isPhoneConflict
            ? "Um ou mais leads já existem neste tracking com o mesmo telefone"
            : "Conflito de dados únicos ao mover os leads",
        });
      }
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
