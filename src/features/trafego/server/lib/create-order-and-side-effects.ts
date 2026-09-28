import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { ensureTrafegoLeadForOrder } from "./ensure-trafego-lead";
import { upsertBriefingResponseForOrder } from "./briefing-form-response";
import { createTrafegoSaleSideEffects } from "./sale-side-effects";
import { moveTrafegoLeadToColumn } from "./lead-card";

interface PostCreationInput {
  orderId: string;
  buyer: {
    userId: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

/**
 * Tudo que acontece DEPOIS da transação que cria o pedido — igual para os
 * três caminhos (resgate público, webhook autenticado, PIX). Cada passo é
 * best-effort: o pedido já existe e nenhum efeito lateral pode invalidá-lo.
 *
 *  1. card do lead (herda o da compra) com o código no apelido;
 *  2. resposta "Briefing TrafeGO" rotulada com o código;
 *  3. lançamentos financeiros;
 *  4. card na coluna "Análise da conta de tráfego";
 *  5. aviso ao cliente (evento ACCOUNT_REVIEW criado na transação) e evento
 *     `trafego/order.created` para o que vier depois (recomendações — Fase D).
 */
export async function runTrafegoOrderPostCreation(input: PostCreationInput): Promise<void> {
  const step = async (name: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      console.error(`[trafego/post-creation] ${name} falhou (${input.orderId}):`, error);
    }
  };

  await step("lead", () => ensureTrafegoLeadForOrder(input.orderId));
  await step("briefing", () => upsertBriefingResponseForOrder(input.orderId));
  await step("financeiro", () =>
    createTrafegoSaleSideEffects({ orderId: input.orderId, buyer: input.buyer }),
  );

  const order = await prisma.trafegoOrder.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      code: true,
      status: true,
      leadId: true,
      events: {
        where: { toStatus: "ACCOUNT_REVIEW" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!order) return;

  if (order.leadId) {
    await step("card", () =>
      moveTrafegoLeadToColumn({
        leadId: order.leadId!,
        columnKey: order.status,
        nickname: order.code,
        note: `trafeGO ${order.code}: pedido criado`,
      }),
    );
  }

  const accountReviewEventId = order.events[0]?.id;
  if (accountReviewEventId) {
    await step("aviso", () =>
      inngest.send({
        name: "trafego/order.status-changed",
        data: {
          orderId: order.id,
          eventId: accountReviewEventId,
          fromStatus: "PAID",
          toStatus: "ACCOUNT_REVIEW",
        },
      }),
    );
  }

  await step("order.created", () =>
    inngest.send({ name: "trafego/order.created", data: { orderId: order.id } }),
  );
}
