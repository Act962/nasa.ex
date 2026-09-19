import { getSeiConfig } from "@/features/sei/server/sei-config";
import { listarUnidades } from "@/features/sei/server/sei-client";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";

export const testSeiConnection = inngest.createFunction(
  { id: "test-sei-connection", retries: 2 },
  { event: "sei/test-connection" },
  async ({ event, step }) => {
    const organizationId = String(event.data.organizationId ?? "");
    if (!organizationId) throw new NonRetriableError("organizationId obrigatório");

    try {
      await step.run("call-sei-listar-unidades", async () => {
        const config = await getSeiConfig(organizationId);
        await listarUnidades(config);
      });
      await step.run("mark-sei-connected", () =>
        prisma.platformIntegration.updateMany({
          where: { organizationId, platform: "SEI" },
          data: { lastSyncAt: new Date(), lastErrorAt: null, lastErrorMessage: null },
        }),
      );
      return { connected: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao conectar ao SEI.";
      await step.run("mark-sei-error", () =>
        prisma.platformIntegration.updateMany({
          where: { organizationId, platform: "SEI" },
          data: { lastErrorAt: new Date(), lastErrorMessage: message.slice(0, 1000) },
        }),
      );
      throw error;
    }
  },
);
