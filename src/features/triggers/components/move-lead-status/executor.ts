import { leadContext } from "@/features/executions/schemas";
import { NodeExecutor } from "@/features/executions/types";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import { MoveLeadStatusTriggerFormValues } from "./dialog";

type MoveLeadStatusTriggerData = {
  action?: MoveLeadStatusTriggerFormValues;
};

export const moveLeadStatusTriggerExecutor: NodeExecutor<
  MoveLeadStatusTriggerData
> = async ({ nodeId, context, step, data }) => {
  const result = await step.run("move-lead-status-trigger", async () => {
    const lead = context.lead;
    const previousLead = context.previousLead;

    const parsedLead = leadContext.safeParse(lead);
    const parsedPreviousLead = leadContext.safeParse(previousLead);

    if (!parsedLead.success || !parsedPreviousLead.success) {
      throw new NonRetriableError("Invalid lead data");
    }

    if (data.action?.statusId === parsedPreviousLead.data.statusId) {
      throw new NonRetriableError("Status not changed");
    }
    /// Condicionais de TAG
    const conditions = data.action?.conditions || [];

    if (conditions.length > 0) {
      // Busca as tags do lead apenas se houver condições relacionadas a tags
      const hasTagConditions = conditions.some((c) =>
        ["CONTAINS_TAG", "NOT_CONTAINS_TAG"].includes(c.type),
      );

      let leadTagIds: string[] = [];

      if (hasTagConditions) {
        const leadTags = await prisma.leadTag.findMany({
          where: { leadId: parsedLead.data.id },
          select: { tagId: true },
        });
        leadTagIds = leadTags.map((lt) => lt.tagId);
      }

      for (const condition of conditions) {
        switch (condition.type) {
          case "CONTAINS_TAG": {
            const hasAll = condition.tagIds.every((id) =>
              leadTagIds.includes(id),
            );
            if (!hasAll) {
              throw new NonRetriableError(
                "Lead does not meet CONTAINS_TAG condition",
              );
            }
            break;
          }
          case "NOT_CONTAINS_TAG": {
            const hasAny = condition.tagIds.some((id) =>
              leadTagIds.includes(id),
            );
            if (hasAny) {
              throw new NonRetriableError(
                "Lead does not meet NOT_CONTAINS_TAG condition",
              );
            }
            break;
          }
          // Futuros tipos de condições podem ser adicionados aqui
          default:
            break;
        }
      }
    }

    return {
      ...context,
      lead: parsedLead.data,
      realTime: false,
    };
  });

  return result;
};
