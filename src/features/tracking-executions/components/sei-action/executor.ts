import { NonRetriableError } from "inngest";
import type { NodeExecutor } from "@/features/tracking-executions/types";
import type { LeadContext } from "@/features/tracking-executions/schemas";
import {
  executeSeiActionForLead,
  type SeiActionData,
} from "@/features/sei/server/execute-sei-action";

export type { SeiActionData };

export const seiActionExecutor: NodeExecutor<SeiActionData> = async ({
  data,
  context,
  step,
}) => {
  const lead = context.lead as LeadContext | undefined;
  if (!lead?.id) throw new NonRetriableError("Lead obrigatório para consultar o SEI.");
  const sei = await step.run("consultar-processo-sei", () =>
    executeSeiActionForLead(lead.id, data),
  );
  return { ...context, sei };
};
