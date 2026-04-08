import { NodeExecutor } from "@/features/executions/types";
import { NonRetriableError } from "inngest";
import { FilterLeadFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import prisma from "@/lib/prisma";
import { filterLeadChannel } from "@/inngest/channels/filter-lead";

type FilterLeadNodeData = {
  action?: FilterLeadFormValues;
};

export const filterLeadExecutor: NodeExecutor<FilterLeadNodeData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const result = await step.run("filter-lead", async () => {
    const leadContextData = context.lead as LeadContext;
    const realTime = context.realTime as boolean;

    try {
      if (realTime) {
        await publish(
          filterLeadChannel().status({
            nodeId,
            status: "loading",
          }),
        );
      }

      const action = data.action;
      if (!action || !action.conditions || action.conditions.length === 0) {
        return context;
      }

      // Fetch the latest lead data with tags
      const lead = await prisma.lead.findUnique({
        where: { id: leadContextData.id },
        include: {
          leadTags: true,
        },
      });

      if (!lead) {
        throw new NonRetriableError("Lead not found");
      }

      const results = action.conditions.map((condition) => {
        switch (condition.field) {
          case "status": {
            const isMatch = condition.value.includes(lead.statusId);
            return condition.operator === "is" ? isMatch : !isMatch;
          }
          case "tag": {
            const leadTagIds = lead.leadTags.map((lt) => lt.tagId);
            const hasMatch = condition.value.some((id) => leadTagIds.includes(id));
            return condition.operator === "contains" ? hasMatch : !hasMatch;
          }
          case "value": {
            const leadAmount = Number(lead.amount);
            const targetValue = Number(condition.value);
            if (condition.operator === "greater_than") {
              return leadAmount > targetValue;
            }
            return leadAmount < targetValue;
          }
          case "name": {
            return lead.name.toLowerCase().trim() === condition.value.toLowerCase().trim();
          }
          case "email": {
            return (lead.email || "").toLowerCase().trim() === condition.value.toLowerCase().trim();
          }
          default:
            return true;
        }
      });

      const isSatisfied =
        action.logic === "and"
          ? results.every((r) => r === true)
          : results.some((r) => r === true);

      if (!isSatisfied) {
        if (realTime) {
          await publish(
            filterLeadChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError("Filtro não satisfeito");
      }

      if (realTime) {
        await publish(
          filterLeadChannel().status({
            nodeId,
            status: "success",
          }),
        );
      }

      return context;
    } catch (error) {
      if (realTime) {
        await publish(
          filterLeadChannel().status({
            nodeId,
            status: "error",
          }),
        );
      }
      throw error;
    }
  });

  return result;
};
