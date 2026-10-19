import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { canAccessTracking } from "@/features/workflows/server/workflow-access";
import { ORPCError } from "@orpc/server";
import { requestLeadMetricsRecompute } from "@/features/leads/lib/metrics/request-recompute";
import { assignedStatusFlowPatch, rodizioQueueWhere } from "@/features/org-defaults/lib/attendance/rodizio";
import { isAttendanceStateEnabled } from "@/features/org-defaults/lib/attendance/flag";
import { applyFinishedAttendance } from "@/features/org-defaults/lib/attendance/state";

export const finishLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Assign lead with round-robin logic",
    tags: ["Tracking Consultant"],
  })
  .input(
    z.object({
      trackingId: z.string(),
      leadId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { trackingId } = input;
    // Só quem é da empresa dona do funil, e só lead daquele funil.
    const leadToFinish = await prisma.lead.findFirst({ where: { id: input.leadId, trackingId }, select: { id: true } });
    if (!leadToFinish || !(await canAccessTracking(trackingId, context.user.id))) {
      throw new ORPCError("NOT_FOUND", { message: "Lead não encontrado" });
    }

    try {
      const leadFinished = await prisma.lead.update({
        where: {
          id: input.leadId,
        },

        data: {
          statusFlow: "FINISHED",
        },
        select: {
          conversation: {
            select: {
              id: true,
            },
          },
          tracking: { select: { organizationId: true } },
        },
      });
      const { organizationId } = leadFinished.tracking;
      // Estado de atendimento (spec 0113): "Finalizado" na etiqueta e a seção da conversa fechada.
      await applyFinishedAttendance({ leadId: input.leadId, outcome: "FINISHED" }).catch((error: unknown) =>
        console.warn("[rodizio.finishLead] attendance state failed", error),
      );
      // Encerrar muda a taxa de resolução do lead (spec 0035).
      await requestLeadMetricsRecompute(input.leadId);

      // 1. Pega o lead mais antigo na lista de espera (WAITING)
      const leadInQueue = await prisma.lead.findFirst({
        where: rodizioQueueWhere({ organizationId, trackingId }),

        orderBy: {
          createdAt: "asc", // FIFO: o mais antigo primeiro
        },
      });

      if (!leadInQueue) {
        return { status: "no-lead-in-queue" };
      }

      // 2. Pega os consultores ativos do tracking, com a contagem de leads ACTIVE que cada um tem
      const consultants = await prisma.trackingConsultant.findMany({
        where: {
          trackingId,
          isActive: true,
        },
        include: {
          user: {
            include: {
              responsibleOnLeads: {
                where: isAttendanceStateEnabled(organizationId)
                  ? { trackingId, statusFlow: { not: "FINISHED" }, currentAction: "ACTIVE", isArchived: false }
                  : { trackingId, statusFlow: "ACTIVE", isActive: true },
              },
            },
          },
        },
      });

      if (consultants.length === 0) {
        return { status: "no-consultant-available" };
      }

      // 3. Roda a lógica de embaralhamento/round-robin:
      //    Encontra o primeiro consultor que ainda tem capacidade disponível
      //    (quantidade de leads ativos < maxFlow)
      const availableConsultant = findAvailableConsultant(consultants);

      if (!availableConsultant) {
        return { status: "no-consultant-available" };
      }

      // 4. Atribui o consultor ao lead e muda o statusFlow para ACTIVE
      const updatedLead = await prisma.lead.update({
        where: { id: leadInQueue.id },
        data: {
          responsibleId: availableConsultant.userId,
          ...assignedStatusFlowPatch(organizationId),
        },
        include: {
          conversation: { select: { id: true } },
          responsible: {
            select: { id: true, name: true, email: true },
          },
          status: true,
        },
      });

      return {
        status: "consultant-found",
        consultantId: availableConsultant.userId,
        lead: leadFinished,
      };
    } catch (error) {
      console.error("Error in newLead handler:", error);
      throw new Error("Failed to assign lead");
    }
  });

// ─── Helpers ────────────────────────────────────────────────────────────────

type ConsultantWithLeads = {
  userId: string;
  maxFlow: number;
  user: {
    responsibleOnLeads: { id: string }[];
  };
};

/**
 * Percorre os consultores em ordem e retorna o primeiro
 * cuja quantidade de leads ativos seja menor que o maxFlow.
 * Espelha exatamente a lógica do script original.
 */
function findAvailableConsultant(
  consultants: ConsultantWithLeads[],
): ConsultantWithLeads | null {
  for (const consultant of consultants) {
    const activeLeads = consultant.user.responsibleOnLeads.length;
    const maxFlow =
      typeof consultant.maxFlow === "number" ? consultant.maxFlow : 0;

    if (activeLeads < maxFlow) {
      return consultant;
    }
  }
  return null;
}
