import type { Prisma } from "@/generated/prisma/client";
import { inngest } from "@/inngest/client";
import { getSeiConfig } from "@/features/sei/server/sei-config";
import { consultarProcedimento } from "@/features/sei/server/sei-client";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";

export const syncSeiProcess = inngest.createFunction(
  { id: "sync-sei-process", retries: 3 },
  { event: "sei/sync-process" },
  async ({ event, step }) => {
    const { linkId, organizationId } = event.data as {
      linkId?: string;
      organizationId?: string;
    };
    if (!linkId || !organizationId) {
      throw new NonRetriableError("linkId e organizationId são obrigatórios");
    }

    const link = await step.run("load-sei-link", () =>
      prisma.seiProcessLink.findFirst({
        where: { id: linkId, organizationId },
      }),
    );
    if (!link) throw new NonRetriableError("Vínculo SEI não encontrado");

    const process = await step.run("consult-sei-process", async () => {
      const config = await getSeiConfig(organizationId);
      return consultarProcedimento(config, link.protocoloProcedimento);
    });

    await step.run("persist-sei-process", () =>
      prisma.seiProcessLink.update({
        where: { id: link.id },
        data: {
          idProcedimento: process.idProcedimento,
          especificacao: process.especificacao,
          tipoProcedimento: process.tipoProcedimento,
          nivelAcesso: process.nivelAcesso,
          ultimoAndamento: process.ultimoAndamento,
          linkAcesso: process.linkAcesso,
          snapshot: process.raw as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        },
      }),
    );

    await prisma.platformIntegration.updateMany({
      where: { organizationId, platform: "SEI" },
      data: { lastSyncAt: new Date(), lastErrorAt: null, lastErrorMessage: null },
    });
    return { linkId, protocolo: process.protocolo };
  },
);
