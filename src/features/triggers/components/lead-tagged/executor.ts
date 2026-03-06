import { leadContext } from "@/features/executions/schemas";
import { NodeExecutor } from "@/features/executions/types";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import { LeadTaggedTriggerFormValues } from "./dialog";

type LeadTaggedTriggerData = {
  action?: LeadTaggedTriggerFormValues;
};

export const leadTaggedTriggerExecutor: NodeExecutor<
  LeadTaggedTriggerData
> = async ({ nodeId, context, step, data }) => {
  const result = await step.run("lead-tagged-trigger", async () => {
    const lead = context.lead;

    const parsedLead = leadContext.safeParse(lead);

    if (!parsedLead.success) {
      throw new NonRetriableError("Invalid lead data");
    }

    const leadTags = await prisma.leadTag.findMany({
      where: { leadId: parsedLead.data.id, tagId: { in: data.action?.tagIds } },
      select: { tagId: true },
    });

    if (leadTags.length === 0) {
      throw new NonRetriableError("Lead does not have the specified tags");
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
      realTime: false,
    };
  });

  return result;
};
