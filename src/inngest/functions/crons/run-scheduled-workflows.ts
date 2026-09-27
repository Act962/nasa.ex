import { inngest } from "@/inngest/client";
import { runScheduledWorkflows } from "@/features/workflows/lib/schedule/run-scheduled-workflows";

// Gatilho "Agendado" dos Gatilhos Automáticos (spec 0039, RF-5).
export const runScheduledWorkflowsCron = inngest.createFunction(
  { id: "run-scheduled-workflows", retries: 1 },
  { cron: "*/5 * * * *" },
  async ({ step }) => step.run("dispatch-due", () => runScheduledWorkflows()),
);
