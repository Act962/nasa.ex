/**
 * Cron: detect-broken-integrations
 *
 * A cada hora, varre integrações importantes da org e dispara alerta se
 * estiverem desconectadas/quebradas há mais de 1h.
 *
 * Detecta hoje:
 *   - WhatsApp: WhatsAppInstance com status=DISCONNECTED e updatedAt<-1h
 *
 * Futuro (quando schema permitir): Meta Ads token expirado, etc.
 * Por ora o token Meta é validado dentro de sync-meta-ads-kpis.ts; podemos
 * fazer aquele cron publicar `integration.meta_token_expired` quando detectar.
 *
 * Idempotência: AlertDispatch unique key dedupa por dia
 * ("wa-down:<instanceId>:<YYYY-MM-DD>"). Mesma instância desconectada 24h
 * só vira 1 notif por dia.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";

export const detectBrokenIntegrations = inngest.createFunction(
  { id: "detect-broken-integrations", retries: 1 },
  { cron: "0 * * * *" }, // hora em hora
  async ({ step }) => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const downInstances = await step.run("fetch-down-wa", async () =>
      prisma.whatsAppInstance.findMany({
        where: {
          status: "DISCONNECTED",
          isActive: true,
          updatedAt: { lt: oneHourAgo },
        },
        select: {
          id: true,
          organizationId: true,
          updatedAt: true,
        },
        take: 200, // cap defensivo
      }),
    );

    let dispatched = 0;
    for (const inst of downInstances) {
      const updatedAtDate = new Date(inst.updatedAt);
      const minutesSince = Math.floor(
        (Date.now() - updatedAtDate.getTime()) / 60_000,
      );

      const result = await dispatchAlert("integration.whatsapp_down", {
        instanceId: inst.id,
        orgId: inst.organizationId,
        disconnectedSinceMinutes: minutesSince,
      });
      dispatched += result.dispatchedCount;
    }

    return { whatsappDown: downInstances.length, dispatched };
  },
);
