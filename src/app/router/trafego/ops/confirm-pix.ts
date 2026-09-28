import { base } from "@/app/middlewares/base";
import { requireTrafegoOperatorMiddleware } from "@/app/middlewares/trafego-operator";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { markTrafegoPurchasePaid } from "@/features/trafego/server/lib/mark-purchase-paid";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";

/**
 * "Confirmar PIX" — a equipe conferiu o comprovante no card e libera o pedido.
 *
 * Aceita pendência `PENDING` e `EXPIRED`: quem paga depois da validade ainda
 * tem o dinheiro na nossa conta, e recusar seria criar um problema comercial
 * para resolver um problema que não existe (spec 0009 CA-9).
 */
export const confirmTrafegoPixPayment = base
  .use(requireTrafegoOperatorMiddleware)
  .input(
    z.object({
      pendingId: z.string().min(1),
      /** Valor lido no comprovante. Diferente do pedido → marca divergência. */
      receivedBrlCents: z.number().int().min(0),
      note: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const pending = await prisma.trafegoPendingPurchase.findUnique({
      where: { id: input.pendingId },
      select: {
        id: true,
        email: true,
        amountBrlCents: true,
        paymentMethod: true,
        pixReference: true,
      },
    });
    if (!pending) {
      throw new ORPCError("NOT_FOUND", { message: "Compra não encontrada." });
    }
    if (pending.paymentMethod !== "PIX") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Esta compra não é PIX — o pagamento dela fecha pelo Stripe.",
      });
    }

    const result = await markTrafegoPurchasePaid({
      pendingId: pending.id,
      paymentSource: "pix",
      amountTotalCents: input.receivedBrlCents,
      pix: { confirmedByUserId: context.operator.id, note: input.note ?? null },
      claimFromStatuses: ["PENDING", "EXPIRED"],
    });

    if (result.status === "not_found") {
      throw new ORPCError("NOT_FOUND", { message: "Compra não encontrada." });
    }

    if (result.status === "already_paid") {
      return {
        confirmed: false as const,
        alreadyPaid: true as const,
        via: result.via,
        message:
          result.via === "stripe"
            ? "Esta compra já foi paga no cartão. Se o PIX também caiu, estorne uma das cobranças."
            : "Este PIX já havia sido confirmado.",
      };
    }

    const settings = await loadTrafegoSettings();
    if (settings.agencyOrganizationId) {
      await logActivity({
        organizationId: settings.agencyOrganizationId,
        userId: context.operator.id,
        userName: context.operator.name,
        userEmail: context.operator.email,
        appSlug: "trafego",
        action: "trafego.pix_confirmed",
        actionLabel: `Confirmou PIX de ${formatBrlFromCents(input.receivedBrlCents)} (${pending.pixReference ?? pending.email})`,
        resource: pending.pixReference ?? pending.email,
        resourceId: pending.id,
        metadata: {
          expectedBrlCents: pending.amountBrlCents,
          receivedBrlCents: input.receivedBrlCents,
          amountMismatch: result.amountMismatch,
        },
      }).catch((error) => console.error("[trafego/pix] logActivity falhou:", error));
    }

    return {
      confirmed: true as const,
      alreadyPaid: false as const,
      amountMismatch: result.amountMismatch,
      message: result.amountMismatch
        ? "PIX confirmado — mas o valor recebido diverge do pedido. Confira antes de definir a verba."
        : "PIX confirmado. O cliente já recebeu o link de acesso.",
    };
  });
