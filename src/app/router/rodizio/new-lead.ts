import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { canAccessTracking } from "@/features/workflows/server/workflow-access";
import { ORPCError } from "@orpc/server";
import {
  assignedStatusFlowPatch,
  consultantLoadWhere,
  queuedStatusFlowPatch,
} from "@/features/org-defaults/lib/attendance/rodizio";
export const newLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Assign lead with round-robin logic",
    tags: ["Tracking Consultant"],
  })
  .input(
    z.object({
      leadId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { leadId } = input;
    const userId = context.user.id;
    const leadToAssign = await prisma.lead.findUnique({ where: { id: leadId }, select: { trackingId: true } });
    if (!leadToAssign || !(await canAccessTracking(leadToAssign.trackingId, userId))) {
      throw new ORPCError("NOT_FOUND", { message: "Lead não encontrado" });
    }

    try {
      // 1. Buscar lead
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          trackingId: true,
          tracking: { select: { organizationId: true } },
        },
      });

      if (!lead) {
        throw new Error("Lead not found");
      }
      const { organizationId } = lead.tracking;

      // 2. Buscar consultores com contagem de leads
      const consultants = await prisma.trackingConsultant.findMany({
        where: {
          trackingId: lead.trackingId,
          isActive: true,
        },
        include: {
          user: true,
          tracking: true,
        },
      });

      // 3. Se não tem consultores → fallback pra você
      if (!consultants.length) {
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            responsibleId: userId,
          },
        });

        return {
          status: "no-consultants",
          assignedTo: "me",
        };
      }

      // 4. Shuffle
      const shuffled = [...consultants].sort(() => Math.random() - 0.5);

      // 5. Encontrar disponível
      let selectedConsultant = null;

      for (const c of shuffled) {
        const leadsCount = await prisma.lead.count({
          where: consultantLoadWhere({ organizationId, trackingId: lead.trackingId, responsibleId: c.userId }),
        });

        if (leadsCount < c.maxFlow) {
          selectedConsultant = c;
          break;
        }
      }

      // 6. Se ninguém disponível → fallback
      if (!selectedConsultant) {
        await prisma.lead.update({
          where: { id: leadId },
          data: queuedStatusFlowPatch(organizationId),
        });

        return {
          status: "no-consultant-available",
          assignedTo: "me",
        };
      }

      // 7. Assign normal
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          responsibleId: selectedConsultant.userId,
          ...assignedStatusFlowPatch(organizationId),
        },
      });

      return {
        status: "assigned",
        consultantId: selectedConsultant.userId,
      };
    } catch (error) {
      console.error(error);
      throw new Error("Failed to assign lead");
    }
  });
