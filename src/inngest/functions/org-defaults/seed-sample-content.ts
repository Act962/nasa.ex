import { inngest } from "@/inngest/client";
import {
  SAMPLE_CONTENT_EVENT,
  SAMPLE_SEEDERS,
  loadSampleSeedContext,
  type SampleContentEventData,
} from "@/features/org-defaults/lib/seed-new-organization";

// Conteúdo de exemplo em cada app da empresa nova (spec 0043). Um step por app: falha num não impede os outros.
export const seedSampleContent = inngest.createFunction(
  { id: "org-defaults-seed-sample-content", retries: 0 },
  { event: SAMPLE_CONTENT_EVENT },
  async ({ event, step }) => {
    const data = event.data as SampleContentEventData;
    const context = await step.run("carrega-trackings", () => loadSampleSeedContext(data));
    const failedApps: string[] = [];
    for (const seeder of SAMPLE_SEEDERS) {
      const isSeeded = await step.run(`exemplo-${seeder.app}`, async () => {
        try {
          await seeder.seed(context);
          return true;
        } catch (error) {
          console.error(`[org-defaults] sample ${seeder.app} failed:`, error);
          return false;
        }
      });
      if (!isSeeded) failedApps.push(seeder.app);
    }
    return { failedApps };
  },
);
