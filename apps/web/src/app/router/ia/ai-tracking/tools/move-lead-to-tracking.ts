import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

/**
 * Move o lead pra OUTRO tracking (não só outro status no mesmo tracking).
 *
 * Diferente de `moveLeadToStatus`:
 *  - moveLeadToStatus: troca de coluna no Kanban DENTRO do mesmo tracking
 *  - moveLeadToTracking: troca o pipeline inteiro (ex: Pré-vendas → Pós-venda)
 *
 * Validação:
 *  - tracking destino deve ser da mesma org do lead
 *  - statusId destino (se passado) deve pertencer ao tracking destino
 *  - se statusId não passado, usa primeiro status do tracking (order=0)
 *
 * Cria registro de jornada (LeadJourneyEvent kind=status_changed +
 * tracking_changed se aplicável) pro Insights mostrar a transição.
 */
export const moveLeadToTrackingTool = (userId: string) =>
  tool({
    description:
      "Move o lead pra um tracking diferente (outro pipeline). Use quando o lead avança pra outra etapa do funil que vive em outro tracking (ex: Pré-vendas → Pós-venda). Opcionalmente especifica em qual status do tracking de destino o lead vai cair.",
    inputSchema: z.object({
      leadId: z.string().describe("ID do lead a mover"),
      targetTrackingId: z
        .string()
        .describe("ID do tracking de destino"),
      targetStatusId: z
        .string()
        .optional()
        .describe(
          "ID do status (coluna) no tracking destino. Se omitido, usa o primeiro status (order=0).",
        ),
    }),
    execute: async ({ leadId, targetTrackingId, targetStatusId }) => {
      try {
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: {
            id: true,
            name: true,
            trackingId: true,
            statusId: true,
            tracking: { select: { organizationId: true, name: true } },
          },
        });
        if (!lead) {
          return { success: false, error: "Lead não encontrado" };
        }

        const targetTracking = await prisma.tracking.findFirst({
          where: {
            id: targetTrackingId,
            organizationId: lead.tracking.organizationId,
          },
          select: { id: true, name: true },
        });
        if (!targetTracking) {
          return {
            success: false,
            error:
              "Tracking destino não existe ou não pertence à mesma organização",
          };
        }

        // Resolve statusId — usa o passado ou primeiro do tracking destino
        let resolvedStatusId = targetStatusId;
        if (!resolvedStatusId) {
          const firstStatus = await prisma.status.findFirst({
            where: { trackingId: targetTrackingId },
            orderBy: { order: "asc" },
            select: { id: true },
          });
          if (!firstStatus) {
            return {
              success: false,
              error: "Tracking destino não tem status configurado",
            };
          }
          resolvedStatusId = firstStatus.id;
        } else {
          // Valida que o statusId passado pertence ao tracking destino
          const status = await prisma.status.findFirst({
            where: { id: resolvedStatusId, trackingId: targetTrackingId },
            select: { id: true },
          });
          if (!status) {
            return {
              success: false,
              error:
                "Status destino não pertence ao tracking informado",
            };
          }
        }

        const previousStatusId = lead.statusId;
        const previousTrackingId = lead.trackingId;

        await prisma.$transaction(async (tx) => {
          await tx.lead.update({
            where: { id: leadId },
            data: {
              trackingId: targetTrackingId,
              statusId: resolvedStatusId,
              order: 0,
            },
          });

          // Journey events (Insights ler daqui)
          await tx.leadJourneyEvent.create({
            data: {
              leadId,
              kind: "status_changed",
              actorId: userId,
              metadata: {
                previousStatusId,
                newStatusId: resolvedStatusId,
                previousTrackingId,
                newTrackingId: targetTrackingId,
                via: "auto-agent",
              },
            },
          });
        });

        return {
          success: true,
          message: `Lead "${lead.name}" movido pro tracking "${targetTracking.name}"`,
          previousTrackingId,
          newTrackingId: targetTrackingId,
        };
      } catch (err) {
        console.error("[moveLeadToTrackingTool] error:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        };
      }
    },
  });
