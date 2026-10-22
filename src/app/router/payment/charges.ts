import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { buildChargeUrl } from "@/features/payment/lib/charge-link";
import { buildChargePixCode, getOpenAmountCents } from "@/features/payment/server/charges/charge-details";
import { PENDING_ENTRY_STATUSES } from "@/features/payment/server/entries/entry-include";

// Spec 0115: link de pagamento de uma conta a receber (página pública com o PIX).

export const getPaymentChargeLink = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "POST", summary: "Get the public payment link of a receivable", tags: ["Payment"] })
  .input(z.object({ entryId: z.string() }))
  .output(z.object({ url: z.string(), hasPixKey: z.boolean(), openAmountCents: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const entry = await prisma.paymentEntry.findFirst({
      where: { id: input.entryId, organizationId: context.org.id },
      select: { id: true, type: true, status: true, amount: true, paidAmount: true },
    });
    if (!entry) throw errors.NOT_FOUND({ message: "Lançamento não encontrado." });
    if (entry.type !== "RECEIVABLE" || !(PENDING_ENTRY_STATUSES as readonly string[]).includes(entry.status)) {
      throw errors.BAD_REQUEST({ message: "Só conta a receber em aberto tem link de pagamento." });
    }

    const openAmountCents = getOpenAmountCents(entry);
    const pixCode = await buildChargePixCode({
      organizationId: context.org.id,
      entryId: entry.id,
      amountCents: openAmountCents,
    });
    return {
      url: buildChargeUrl(context.org.id, entry.id),
      hasPixKey: pixCode !== null,
      openAmountCents,
    };
  });
