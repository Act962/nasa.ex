import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { assertOrderEditable } from "@/features/trafego/server/lib/assert-order-editable";
import { trafegoBriefingSchema } from "@/features/trafego/schema/trafego-schemas";
import { upsertBriefingResponseForOrder } from "@/features/trafego/server/lib/briefing-form-response";
import { checkWhatsappNumber } from "@/features/trafego/server/lib/whatsapp-number-check";
import { ORPCError } from "@orpc/server";

export const updateTrafegoBriefing = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(trafegoBriefingSchema.extend({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const order = await assertOrderEditable(input.orderId, context.org.id);

    const emptyToNull = (value?: string) =>
      value && value.trim() ? value.trim() : null;
    const whatsappNumber = emptyToNull(input.whatsappNumber);

    if (whatsappNumber) {
      const check = await checkWhatsappNumber(whatsappNumber);
      if (check.status === "invalid_phone") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Informe um celular válido com DDD.",
        });
      }
      if (check.status === "not_found") {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "Esse número não foi encontrado no WhatsApp. Confira o DDD e o dígito 9.",
        });
      }
    }

    await prisma.trafegoOrder.update({
      where: { id: order.id },
      data: {
        businessName: emptyToNull(input.businessName),
        businessNiche: emptyToNull(input.businessNiche),
        targetAudience: emptyToNull(input.targetAudience),
        destinationUrl: emptyToNull(input.destinationUrl),
        whatsappNumber,
        notes: emptyToNull(input.notes),
      },
    });

    // O card do gestor mostra o briefing como resposta de formulário — acompanha a edição.
    await upsertBriefingResponseForOrder(order.id).catch((error) =>
      console.error(
        "[trafego/briefing] resposta no card não atualizada:",
        error,
      ),
    );

    return { success: true };
  });
