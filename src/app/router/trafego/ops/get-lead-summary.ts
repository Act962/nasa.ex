import { base } from "@/app/middlewares/base";
import { requireTrafegoOperatorMiddleware } from "@/app/middlewares/trafego-operator";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";

/**
 * O que o card do lead mostra na aba trafeGO: a compra pendente (para o botão
 * "Confirmar PIX") e o pedido corrente. Devolve `null` — não erro — quando o
 * lead não é do trafeGO, porque a aba pergunta para todo lead que abre.
 */
export const getTrafegoLeadSummary = base
  .use(requireTrafegoOperatorMiddleware)
  .input(z.object({ leadId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const settings = await loadTrafegoSettings();
    if (!settings.operationsTrackingId) return null;

    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, trackingId: settings.operationsTrackingId },
      select: { id: true },
    });
    if (!lead) return null;

    const [pendings, orders] = await Promise.all([
      prisma.trafegoPendingPurchase.findMany({
        where: { leadId: lead.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          pixReference: true,
          pixExpiresAt: true,
          pixConfirmedAt: true,
          amountBrlCents: true,
          adBudgetBrlCents: true,
          amountMismatch: true,
          createdAt: true,
          pixConfirmedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.trafegoOrder.findMany({
        where: { leadId: lead.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          code: true,
          status: true,
          platform: true,
          objective: true,
          totalBrlCents: true,
          adBudgetBrlCents: true,
          paymentMethod: true,
          phoneVerifiedAt: true,
          socialHandle: true,
          officialNumber: true,
          createdAt: true,
        },
      }),
    ]);

    if (pendings.length === 0 && orders.length === 0) return null;

    return {
      leadId: lead.id,
      // Só o que ainda espera dinheiro entra como "confirmável".
      awaitingPix: pendings.filter(
        (pending) =>
          pending.paymentMethod === "PIX" &&
          (pending.status === "PENDING" || pending.status === "EXPIRED"),
      ),
      pendings,
      orders,
    };
  });
