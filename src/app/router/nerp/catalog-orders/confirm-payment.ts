import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import { ManualPaymentError, confirmManualCatalogOrderPayment } from "@/features/nerp-catalog/lib/manual-payment";

// Loja sem Asaas: "Confirmar pagamento recebido" na aba Pedido. Só quem pode marcar pagamentos como pagos no Financeiro.
export const confirmCatalogOrderPaymentManually = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("financeiro", "canPay"))
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    try {
      return await confirmManualCatalogOrderPayment({
        organizationId: context.org.id,
        orderId: input.orderId,
      });
    } catch (error) {
      if (error instanceof ManualPaymentError) throw errors.BAD_REQUEST({ message: error.message });
      throw error;
    }
  });
