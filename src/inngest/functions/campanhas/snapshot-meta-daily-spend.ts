import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { snapshotMetaDailySpend } from "@/features/campanhas/server/lib/number-costs";

const BRAZIL_OFFSET_MS = 3 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/**
 * Guarda o gasto de ontem de cada número oficial na Meta (spec 0087, RF-26), para o
 * histórico de custos em /campanhas não depender de leitura ao vivo.
 */
export const snapshotMetaDailySpendCron = inngest.createFunction(
  { id: "campanhas-snapshot-meta-daily-spend", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 20 5 * * *" },
  async ({ step }) => {
    const yesterday = new Date(Date.now() - BRAZIL_OFFSET_MS - DAY_MS).toISOString().slice(0, 10);
    const instances = await step.run("load-official-numbers", () =>
      prisma.whatsAppInstance.findMany({
        where: { provider: "META_CLOUD", metaPhoneNumberId: { not: null }, metaAccessToken: { not: null } },
        select: { trackingId: true, organizationId: true },
      }),
    );
    let saved = 0;
    for (const instance of instances) {
      if (!instance.trackingId || !instance.organizationId) continue;
      const outcome = await step.run(`snapshot-${instance.trackingId}`, async () => {
        try {
          return await snapshotMetaDailySpend({ organizationId: instance.organizationId!, trackingId: instance.trackingId!, day: yesterday });
        } catch (snapshotError) {
          // Chave vencida ou conta sem permissão: este número fica sem o dia, os outros seguem.
          console.warn(`[campanhas] gasto diário da Meta não guardado para ${instance.trackingId}:`, snapshotError instanceof Error ? snapshotError.message.slice(0, 160) : "erro");
          return { saved: 0 };
        }
      });
      saved += outcome.saved;
    }
    return { day: yesterday, numbers: instances.length, saved };
  },
);
