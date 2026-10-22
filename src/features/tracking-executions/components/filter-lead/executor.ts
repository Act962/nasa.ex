import { NodeExecutor } from "@/features/tracking-executions/types";
import { NonRetriableError } from "inngest";
import { FilterLeadFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import { filterLeadChannel } from "@/inngest/channels/filter-lead";
import { type WorkflowLeadMessage } from "../../lib/lead-message";
import { evaluateLeadFilter } from "../../lib/filter-conditions";

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
    // Preenchido pelos gatilhos que carregam mensagem (spec 0008). Ausente
    // em gatilho sem mensagem — lead de formulário, gatilho manual, etc.
    const leadMessage = context.leadMessage as WorkflowLeadMessage | undefined;

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

      const isSatisfied = await evaluateLeadFilter({
        filter: action,
        leadId: leadContextData.id,
        leadMessage,
      });

      if (isSatisfied === null) {
        throw new NonRetriableError("Lead not found");
      }

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
