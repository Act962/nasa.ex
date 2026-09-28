import "server-only";
import prisma from "@/lib/prisma";
import { MATERIALS_AUTO_SUBMIT_FROM } from "@/features/trafego/lib/order-status";
import { transitionTrafegoOrder } from "./transition-order";

/**
 * "Materiais enviados" acontece sozinho: ≥1 criativo e ≥1 copy selecionada.
 *
 * Em ONBOARDING/CHANGES_REQUESTED vira transição de status. Em ACCOUNT_REVIEW
 * só carimba `materialsSubmittedAt` — o status avança quando a equipe
 * libera a conta (ver `transitionTrafegoOrder`). Monotônico: remover um
 * criativo depois não volta o status.
 */
export async function maybeMarkMaterialsSubmitted(
  orderId: string,
): Promise<void> {
  const order = await prisma.trafegoOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      materialsSubmittedAt: true,
      materialsProfileLink: true,
      _count: { select: { creatives: true } },
    },
  });
  const hasMaterials =
    Boolean(order?.materialsProfileLink) || (order?._count.creatives ?? 0) > 0;
  if (!order || !hasMaterials) return;

  const selectedCopies = await prisma.trafegoCopy.count({
    where: { orderId: order.id, isSelected: true },
  });
  if (selectedCopies === 0) return;

  if (MATERIALS_AUTO_SUBMIT_FROM.includes(order.status)) {
    await transitionTrafegoOrder({
      orderId: order.id,
      toStatus: "MATERIALS_SUBMITTED",
      source: "CLIENT",
      expectedFrom: [order.status],
      clientNote:
        'Criativos e copy recebidos. Quando quiser, clique em "Ativar campanha" para enviar à equipe.',
    });
    return;
  }

  if (order.status === "ACCOUNT_REVIEW" && !order.materialsSubmittedAt) {
    await prisma.trafegoOrder.update({
      where: { id: order.id },
      data: { materialsSubmittedAt: new Date() },
    });
  }
}
