/**
 * `astro/command.run` — executa um comando do ASTRO (spec 0023).
 *
 * Concorrência limitada por organização (RNF-2): um comando por evento numa
 * importação de 500 leads não pode virar 500 chamadas de LLM ao mesmo tempo.
 */

import { inngest } from "@/inngest/client";
import { runCommand } from "@/features/astro-commander/server/run-command";
import type { AstroCommandRunTrigger } from "@/generated/prisma/enums";

export const astroCommandRun = inngest.createFunction(
  {
    id: "astro-command-run",
    retries: 1,
    concurrency: { key: "event.data.organizationId", limit: 3 },
  },
  { event: "astro/command.run" },
  async ({ event, step }) => {
    const data = event.data as {
      commandId: string;
      trigger?: AstroCommandRunTrigger;
      scheduledFor?: string;
      triggerKey?: string;
      eventPayload?: Record<string, unknown>;
      actorUserId?: string;
    };

    return step.run("executar", () =>
      runCommand({
        commandId: data.commandId,
        trigger: data.trigger ?? "SCHEDULE",
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
        triggerKey: data.triggerKey,
        eventPayload: data.eventPayload,
        actorUserId: data.actorUserId,
      }),
    );
  },
);
