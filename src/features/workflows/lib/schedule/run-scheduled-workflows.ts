// Varredura do gatilho "Agendado" (spec 0039, RF-5, RNF-1).

import "server-only";
import prisma from "@/lib/prisma";
import { sendWorkflowExecution } from "@/inngest/utils";
import { parseSchedule, resolveDueSlot } from "./schedule-slot";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/** `organizationId` restringe a uma org (bateria de QA). O cron roda sem escopo. */
export async function runScheduledWorkflows(scope: { organizationId?: string } = {}) {
  const now = new Date();
  const workflows = await prisma.workflow.findMany({
    where: {
      isActive: true,
      nodes: { some: { type: "SCHEDULE_TRIGGER" } },
      ...(scope.organizationId ? { tracking: { organizationId: scope.organizationId } } : {}),
    },
    select: {
      id: true,
      leadId: true,
      userId: true,
      tracking: { select: { organizationId: true } },
      nodes: { where: { type: "SCHEDULE_TRIGGER" }, select: { data: true } },
    },
  });

  let dispatched = 0;
  for (const workflow of workflows) {
    for (const node of workflow.nodes) {
      const schedule = parseSchedule((node.data as { schedule?: unknown } | null)?.schedule);
      const slotKey = schedule ? resolveDueSlot(schedule, now) : null;
      if (!slotKey) continue;
      try {
        await prisma.workflowScheduleClaim.create({ data: { workflowId: workflow.id, slotKey } });
      } catch (error) {
        // Outra varredura já reservou este horário (CA-4).
        if (isUniqueViolation(error)) continue;
        throw error;
      }
      await sendWorkflowExecution({
        workflowId: workflow.id,
        triggerType: "SCHEDULE_TRIGGER",
        leadId: workflow.leadId,
        initialData: {
          scheduledSlot: slotKey,
          workflowOwnerId: workflow.userId,
          organizationId: workflow.tracking?.organizationId ?? null,
        },
      });
      dispatched += 1;
    }
  }
  return { scanned: workflows.length, dispatched };
}
