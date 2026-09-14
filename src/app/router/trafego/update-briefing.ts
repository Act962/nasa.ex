import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { assertOrderEditable } from "@/features/trafego/server/lib/assert-order-editable";
import { trafegoBriefingSchema } from "@/features/trafego/schema/trafego-schemas";
import { upsertBriefingResponseForOrder } from "@/features/trafego/server/lib/briefing-form-response";

export const updateTrafegoBriefing = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(trafegoBriefingSchema.extend({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const order = await assertOrderEditable(input.orderId, context.org.id);

    const emptyToNull = (value?: string) =>
      value && value.trim() ? value.trim() : null;

    await prisma.trafegoOrder.update({
      where: { id: order.id },
      data: {
        businessName: emptyToNull(input.businessName),
        businessNiche: emptyToNull(input.businessNiche),
        targetAudience: emptyToNull(input.targetAudience),
        destinationUrl: emptyToNull(input.destinationUrl),
        whatsappNumber: emptyToNull(input.whatsappNumber),
        notes: emptyToNull(input.notes),
      },
    });

    // O card do gestor mostra o briefing como resposta de formulário — acompanha a edição.
    await upsertBriefingResponseForOrder(order.id).catch((error) =>
      console.error("[trafego/briefing] resposta no card não atualizada:", error),
    );

    return { success: true };
  });
