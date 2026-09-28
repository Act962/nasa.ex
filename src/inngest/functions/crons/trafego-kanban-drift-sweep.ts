/**
 * Cron: trafego-kanban-drift-sweep
 *
 * De hora em hora, confere se o card de cada pedido em andamento está na
 * coluna do status. Divergência acontece pelos caminhos que mudam a coluna
 * sem publicar no event-bus (workflow MOVE_LEAD, tool do Astro).
 *
 * Regra (spec 0009 D-2): o PEDIDO é a autoridade. Se o card mudou depois da
 * última atualização do pedido, alguém mexeu de propósito — avisa o admin em
 * vez de adivinhar; caso contrário, move o card.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { TERMINAL_ORDER_STATUSES } from "@/features/trafego/lib/order-status";
import { loadTrafegoSettings, statusIdForColumnKey } from "@/features/trafego/server/lib/trafego-settings";
import { moveTrafegoLeadToColumn } from "@/features/trafego/server/lib/lead-card";

const BATCH_SIZE = 200;

export const trafegoKanbanDriftSweep = inngest.createFunction(
  { id: "trafego-kanban-drift-sweep", retries: 1 },
  { cron: "30 * * * *" },
  async ({ step }) => {
    const settings = await step.run("load-settings", () => loadTrafegoSettings({ fresh: true }));
    if (!settings.operationsTrackingId) return { skipped: "no_operations_tracking" };

    const orders = await step.run("load-orders", () =>
      prisma.trafegoOrder.findMany({
        where: {
          leadId: { not: null },
          status: { notIn: TERMINAL_ORDER_STATUSES },
        },
        orderBy: { updatedAt: "desc" },
        take: BATCH_SIZE,
        select: {
          id: true,
          code: true,
          status: true,
          updatedAt: true,
          lead: { select: { id: true, trackingId: true, statusId: true, lastStatusChangeAt: true } },
        },
      }),
    );

    const result = await step.run("reconcile", async () => {
      const moved: string[] = [];
      const flagged: string[] = [];

      for (const order of orders) {
        const lead = order.lead;
        if (!lead || lead.trackingId !== settings.operationsTrackingId) continue;
        const expectedStatusId = statusIdForColumnKey(settings, order.status);
        if (!expectedStatusId || lead.statusId === expectedStatusId) continue;

        const cardMovedAfterOrder =
          lead.lastStatusChangeAt !== null &&
          new Date(lead.lastStatusChangeAt) > new Date(order.updatedAt);

        if (cardMovedAfterOrder) {
          flagged.push(order.code);
          continue;
        }

        const outcome = await moveTrafegoLeadToColumn({
          leadId: lead.id,
          columnKey: order.status,
          nickname: order.code,
          note: `trafeGO ${order.code}: card realinhado ao status do pedido`,
        });
        if (outcome === "moved") moved.push(order.code);
      }

      if (flagged.length > 0) {
        const admins = await prisma.user.findMany({
          where: { isSystemAdmin: true, isActive: true },
          select: { id: true },
        });
        if (admins.length > 0) {
          await prisma.userNotification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              type: "CUSTOM",
              title: `trafeGO: ${flagged.length} card(s) fora da coluna do pedido`,
              body: `Movidos depois da última atualização do pedido — confira: ${flagged.join(", ")}`,
              appKey: "trafego",
              actionUrl: "/admin/trafego",
            })),
          });
        }
      }

      return { moved, flagged };
    });

    return { checked: orders.length, ...result };
  },
);
