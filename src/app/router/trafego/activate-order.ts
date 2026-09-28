import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { beginTrafegoActivation } from "@/features/trafego/server/lib/begin-trafego-activation";
import { isOrderActivatable } from "@/features/trafego/lib/order-status";

/**
 * "Ativar campanha" — o cliente declara que os materiais estão prontos e o
 * pedido entra na fila da equipe. Não publica nada no Meta nem cria Broadcast:
 * a execução é da equipe (ver specs/trafego/0008 §2 não-objetivos).
 */
export const activateTrafegoOrder = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const order = await prisma.trafegoOrder.findFirst({
      where: { id: input.orderId, organizationId: context.org.id },
      select: {
        id: true,
        status: true,
        targetAudience: true,
        destinationUrl: true,
        whatsappNumber: true,
        platform: true,
        _count: {
          select: {
            creatives: true,
            copies: { where: { isSelected: true } },
          },
        },
      },
    });

    if (!order) {
      throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada." });
    }
    if (!isOrderActivatable(order.status)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Esta campanha já foi enviada para a equipe.",
      });
    }
    if (order._count.creatives === 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Envie pelo menos um criativo antes de ativar.",
      });
    }
    if (order._count.copies === 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Selecione pelo menos uma copy antes de ativar.",
      });
    }

    const missingDestination =
      order.platform === "META_ADS"
        ? !order.destinationUrl && !order.whatsappNumber
        : !order.whatsappNumber;
    if (missingDestination) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          order.platform === "META_ADS"
            ? "Informe o site de destino ou o WhatsApp que vai receber os contatos."
            : "Informe o número de WhatsApp da campanha.",
      });
    }

    const claimed = await beginTrafegoActivation({
      orderId: order.id,
      organizationId: context.org.id,
      actorUserId: context.user.id,
    });

    if (!claimed) {
      // Alguém já ativou entre a leitura e o claim — não é erro pro usuário.
      return { activated: false, alreadyRequested: true };
    }

    return { activated: true, alreadyRequested: false };
  });
