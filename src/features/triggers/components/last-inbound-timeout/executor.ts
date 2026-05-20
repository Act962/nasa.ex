import { NodeExecutor } from "@/features/executions/types";
import { leadContext } from "@/features/executions/schemas";
import { NonRetriableError } from "inngest";

/**
 * Executor do gatilho LAST_INBOUND_TIMEOUT.
 *
 * O gatilho propriamente dito (sleep + recheck) é orquestrado pela função
 * Inngest `lastInboundTimeoutWatcher` (em `src/inngest/functions/triggers/`).
 * Esse executor só passa o contexto adiante quando o workflow já foi
 * disparado — funcionando como entrypoint que valida o lead e segue pra
 * próxima ação (geralmente WAIT ou SEND_MESSAGE).
 */
type Data = Record<string, unknown>;

export const lastInboundTimeoutTriggerExecutor: NodeExecutor<Data> = async ({
  context,
  step,
}) => {
  const result = await step.run("last-inbound-timeout-trigger", async () => {
    const lead = context.lead;
    const parsedLead = leadContext.safeParse(lead);

    if (!parsedLead.success) {
      throw new NonRetriableError("Invalid lead data on LAST_INBOUND_TIMEOUT");
    }

    return {
      ...context,
      lead: parsedLead.data,
      realTime: false,
    };
  });

  return result;
};
