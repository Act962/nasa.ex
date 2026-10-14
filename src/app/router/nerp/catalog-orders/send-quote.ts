import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import { CatalogQuoteError, sendOrderQuote } from "@/features/nerp-catalog/lib/order-quote-actions";
import { InvalidQuoteError } from "@/features/nerp-catalog/lib/order-quote";

const moneySchema = z.number().nonnegative().max(10_000_000);

// Spec 0103, RF-3: o atendente manda o valor negociado; o cliente aprova pelo Astro.
export const sendCatalogOrderQuote = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("lead-produtos", "canEdit"))
  .input(
    z.object({
      orderId: z.string().min(1),
      unitPrices: z.array(moneySchema).min(1),
      shipping: moneySchema.default(0),
      discount: moneySchema.default(0),
      note: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      return await sendOrderQuote({
        organizationId: context.org.id,
        orderId: input.orderId,
        userId: context.user.id,
        senderName: context.user.name,
        quote: { unitPrices: input.unitPrices, shipping: input.shipping, discount: input.discount },
        note: input.note,
      });
    } catch (error) {
      if (error instanceof CatalogQuoteError || error instanceof InvalidQuoteError) {
        throw errors.BAD_REQUEST({ message: error.message });
      }
      throw error;
    }
  });
