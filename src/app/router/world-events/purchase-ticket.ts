import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { executeTicketPurchaseInTx } from "./helpers/purchase-ticket-helpers";
import { randomBytes } from "node:crypto";

/**
 * Compra de ingresso pra um WorldEvent.
 *
 * Suporta 3 métodos:
 *   - "stars"  → debita STARs da org ativa do comprador, gera ticket ACTIVE.
 *   - "stripe" → retorna info pro client iniciar Stripe Checkout; webhook
 *                gera o ticket depois (não nessa call).
 *   - "free"   → eventos `isFree=true`, sem cobrança.
 *
 * Idempotência: se o user já tem ticket ACTIVE pra esse evento, retorna o
 * existente em vez de criar um novo.
 */
export const purchaseTicket = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/world-events/purchase-ticket",
    summary: "Compra ingresso de WorldEvent (STARs/Stripe/free)",
  })
  .input(
    z.object({
      eventId: z.string(),
      paymentMethod: z.enum(["stars", "stripe", "free"]),
    }),
  )
  .output(
    z.object({
      ticketId: z.string().nullable(),
      accessToken: z.string().nullable(),
      // Pra "stripe": URL retornada pra redirect (gerada no client via Stripe Checkout)
      stripeCheckoutHint: z
        .object({
          eventId: z.string(),
          priceBrl: z.number(),
        })
        .nullable(),
      // Já tinha ingresso ACTIVE
      alreadyOwned: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const event = await prisma.worldEvent.findUnique({
      where: { id: input.eventId },
      select: {
        id: true,
        title: true,
        ticketPriceStars: true,
        ticketPriceBrl: true,
        isFree: true,
        status: true,
        payoutPercent: true,
        endsAt: true,
        station: { select: { orgId: true, userId: true } },
      },
    });
    if (!event) throw errors.NOT_FOUND({ message: "Evento não encontrado." });
    if (event.status === "CANCELLED") {
      throw errors.BAD_REQUEST({ message: "Evento cancelado." });
    }
    if (event.endsAt.getTime() < Date.now()) {
      throw errors.BAD_REQUEST({ message: "Evento já terminou." });
    }

    // Já tem ingresso ACTIVE? — retorna o existente (idempotência).
    const existing = await prisma.worldEventTicket.findFirst({
      where: {
        worldEventId: event.id,
        holderUserId: context.user.id,
        status: "ACTIVE",
      },
      select: { id: true, accessToken: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return {
        ticketId: existing.id,
        accessToken: existing.accessToken,
        stripeCheckoutHint: null,
        alreadyOwned: true,
      };
    }

    // Free flow — só cria ticket.
    if (input.paymentMethod === "free" || event.isFree) {
      if (!event.isFree && input.paymentMethod === "free") {
        throw errors.BAD_REQUEST({
          message: "Esse evento não é gratuito.",
        });
      }
      const accessToken = randomBytes(16).toString("hex");
      const ticket = await prisma.worldEventTicket.create({
        data: {
          worldEventId: event.id,
          holderUserId: context.user.id,
          buyerUserId: context.user.id,
          paymentMethod: "free",
          accessToken,
          status: "ACTIVE",
        },
        select: { id: true, accessToken: true },
      });
      return {
        ticketId: ticket.id,
        accessToken: ticket.accessToken,
        stripeCheckoutHint: null,
        alreadyOwned: false,
      };
    }

    // STARs flow — débito + payout + ticket dentro de transação.
    if (input.paymentMethod === "stars") {
      if (!event.ticketPriceStars || event.ticketPriceStars <= 0) {
        throw errors.BAD_REQUEST({
          message: "Esse evento não aceita pagamento em STARs.",
        });
      }
      const hostOrgId = event.station?.orgId;
      if (!hostOrgId) {
        throw errors.BAD_REQUEST({
          message: "Station host não está vinculada a uma org — payout indisponível.",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        return executeTicketPurchaseInTx({
          tx,
          holderUserId: context.user.id,
          buyerOrgId: context.org.id,
          worldEventId: event.id,
          worldEventTitle: event.title,
          hostOrgId,
          priceStars: event.ticketPriceStars!,
          payoutPercent: event.payoutPercent,
        });
      });

      return {
        ticketId: result.ticketId,
        accessToken: result.accessToken,
        stripeCheckoutHint: null,
        alreadyOwned: false,
      };
    }

    // Stripe flow — retorna hint pro client iniciar Checkout.
    // Webhook do Stripe (em /api/stripe/webhook) gera o ticket após pagamento.
    if (input.paymentMethod === "stripe") {
      if (!event.ticketPriceBrl) {
        throw errors.BAD_REQUEST({
          message: "Esse evento não aceita pagamento em R$.",
        });
      }
      return {
        ticketId: null,
        accessToken: null,
        stripeCheckoutHint: {
          eventId: event.id,
          priceBrl: Number(event.ticketPriceBrl),
        },
        alreadyOwned: false,
      };
    }

    throw errors.BAD_REQUEST({ message: "Método de pagamento inválido." });
  });
