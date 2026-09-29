import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { findOrderByPublicToken } from "@/features/nerp-catalog/lib/portal-order";
import {
  CatalogOrderPaymentError,
  createOrderPixCharge,
} from "@/features/nerp-catalog/lib/order-payments";
import { CatalogPaymentNotConfiguredError } from "@/features/nerp-catalog/lib/integration-config";

const PIX_PAYABLE_STATUSES = new Set(["RECEIVED", "NEGOTIATING"]);

// O próprio cliente gera o PIX pelo portal, sem esperar o Astro. Só pedido ainda
// sem cobrança: depois do primeiro PIX o status vira AWAITING_PAYMENT e trava novas cobranças.
export const payPublicCatalogOrderWithPix = base
  .input(
    z.object({
      token: z.string().min(16),
      document: z
        .string()
        .transform((value) => value.replace(/\D/g, ""))
        .refine((digits) => digits.length === 11 || digits.length === 14, "Informe um CPF ou CNPJ válido"),
    }),
  )
  .handler(async ({ input, errors }) => {
    const order = await findOrderByPublicToken(input.token);
    if (!order) throw errors.NOT_FOUND({ message: "Pedido não encontrado" });
    if (!PIX_PAYABLE_STATUSES.has(order.status)) {
      throw errors.BAD_REQUEST({ message: "Este pedido já tem uma cobrança ou foi finalizado." });
    }

    try {
      const pix = await createOrderPixCharge(order.id, input.document);
      return { expiresAt: pix.expiresAt, total: pix.total };
    } catch (error) {
      if (error instanceof CatalogOrderPaymentError || error instanceof CatalogPaymentNotConfiguredError) {
        throw errors.BAD_REQUEST({ message: error.message });
      }
      console.error("[catalog-order/pay-with-pix] charge_failed", error);
      throw errors.BAD_REQUEST({ message: "Não foi possível gerar o PIX agora. Tente de novo ou fale com a loja." });
    }
  });
