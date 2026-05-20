import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { sendWorkflowExecution } from "@/inngest/utils";
import { NodeType } from "@/generated/prisma/enums";
import { NonRetriableError } from "inngest";

/**
 * Gatilho LAST_INBOUND_TIMEOUT — orquestração time-based.
 *
 * Como funciona:
 *  1. Webhook do chat (quando mensagem inbound chega) atualiza
 *     `Lead.lastInboundAt = now` e dispara o evento
 *     `chat/inbound-message.received` com `{ leadId, inboundAt }`.
 *  2. `scheduleInboundTimeoutChecks` (esta função) recebe o evento,
 *     busca workflows com gatilho LAST_INBOUND_TIMEOUT no mesmo tracking,
 *     e pra cada um dispara um sub-evento `workflow/check-inbound-timeout`
 *     com fireAt = lastInboundAt + minutes do nó.
 *  3. `checkInboundTimeout` (outra função aqui) dorme até fireAt,
 *     recebusca o lead, e SE `lastInboundAt` continuar igual (lead não
 *     mandou nova mensagem nesse intervalo), dispara o workflow.
 *     Caso contrário, cancela silenciosamente.
 */

/**
 * Função A — recebe `chat/inbound-message.received` e agenda checks
 * pra cada workflow ativo com LAST_INBOUND_TIMEOUT.
 */
export const scheduleInboundTimeoutChecks = inngest.createFunction(
  { id: "schedule-inbound-timeout-checks", retries: 1 },
  { event: "chat/inbound-message.received" },
  async ({ event, step }) => {
    const { leadId, inboundAt } = event.data as {
      leadId: string;
      inboundAt: string;
    };
    if (!leadId || !inboundAt) {
      throw new NonRetriableError("leadId + inboundAt required");
    }

    const scheduled = await step.run("find-workflows", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { trackingId: true },
      });
      if (!lead) return [];

      const workflows = await prisma.workflow.findMany({
        where: {
          trackingId: lead.trackingId,
          isActive: true,
          nodes: { some: { type: NodeType.LAST_INBOUND_TIMEOUT } },
        },
        include: {
          nodes: {
            where: { type: NodeType.LAST_INBOUND_TIMEOUT },
            select: { id: true, data: true },
          },
        },
      });

      return workflows.map((w) => {
        const triggerNode = w.nodes[0];
        const rawMinutes = (triggerNode?.data as { minutes?: number })?.minutes;
        const minutes = Math.max(
          1,
          Math.min(14400, Number(rawMinutes ?? 30)),
        );
        const fireAt = new Date(
          new Date(inboundAt).getTime() + minutes * 60_000,
        ).toISOString();
        return { workflowId: w.id, minutes, fireAt };
      });
    });

    if (scheduled.length === 0) {
      return { scheduled: 0 };
    }

    await step.sendEvent(
      "fan-out-timeout-checks",
      scheduled.map((s) => ({
        name: "workflow/check-inbound-timeout",
        data: {
          workflowId: s.workflowId,
          leadId,
          originalInboundAt: inboundAt,
          fireAt: s.fireAt,
        },
      })),
    );

    return { scheduled: scheduled.length };
  },
);

/**
 * Função B — espera até fireAt, recheca lead.lastInboundAt e dispara o
 * workflow se nada novo chegou nesse intervalo.
 */
export const checkInboundTimeout = inngest.createFunction(
  { id: "check-inbound-timeout", retries: 0 },
  { event: "workflow/check-inbound-timeout" },
  async ({ event, step }) => {
    const { workflowId, leadId, originalInboundAt, fireAt } = event.data as {
      workflowId: string;
      leadId: string;
      originalInboundAt: string;
      fireAt: string;
    };

    await step.sleepUntil("wait-for-timeout", new Date(fireAt));

    const result = await step.run("recheck-and-fire", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          status: true,
          tracking: { select: { id: true, organizationId: true } },
          conversation: true,
          responsible: true,
        },
      });

      if (!lead) return { cancelled: "lead-deleted" } as const;

      // Recheck: se chegou nova mensagem inbound, abortar (lead respondeu
      // — não faz sentido cutucar agora).
      if (
        !lead.lastInboundAt ||
        new Date(lead.lastInboundAt).getTime() !==
          new Date(originalInboundAt).getTime()
      ) {
        return { cancelled: "new-inbound-received" } as const;
      }

      // Lead virou Ganho/Perdido nesse meio tempo? Não faz sentido cutucar.
      if (lead.statusFlow !== "ACTIVE" && lead.statusFlow !== "WAITING") {
        return { cancelled: `status-flow:${lead.statusFlow}` } as const;
      }

      await sendWorkflowExecution({
        workflowId,
        initialData: { lead },
      });

      return { fired: true } as const;
    });

    return result;
  },
);
