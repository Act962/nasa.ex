// Executa o código de um cron dentro de outra função sem criar steps no Inngest.
// O Inngest cobra execuções = runs × (steps + 1): um cron de polling com 2 steps
// custa 3 execuções mesmo quando não acha nada. Ver `functions/crons/polling-tickers.ts`.

import type { GetStepTools } from "inngest";
import { inngest } from "./client";

export type InlineStep = Pick<GetStepTools<typeof inngest>, "run" | "sendEvent">;

type SendEventPayload = Parameters<typeof inngest.send>[0];

// Mesmo formato que o `step.run` devolve: o resultado passa por JSON (Date vira string).
function toSerialized(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function createInlineStep(): InlineStep {
  const inlineStep = {
    run: async (_stepId: string, handler: () => unknown) => toSerialized(await handler()),
    sendEvent: async (_stepId: string, payload: SendEventPayload) => inngest.send(payload),
  };
  return inlineStep as unknown as InlineStep;
}
