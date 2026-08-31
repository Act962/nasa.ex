import { orpc, client } from "@/lib/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { TrafegoCheckoutBody } from "@/features/trafego/schema/trafego-schemas";

/**
 * Status da compra. A página de sucesso faz polling até `PAID` — o webhook do
 * Stripe é assíncrono, então o retorno do checkout chega antes da confirmação.
 */
export const useTrafegoPendingPurchase = (
  input: { pendingId?: string; signupToken?: string },
  options?: { enabled?: boolean; refetchInterval?: number | false },
) => {
  return useQuery({
    ...orpc.trafego.getPendingPurchase.queryOptions({ input }),
    enabled: (options?.enabled ?? true) && Boolean(input.pendingId || input.signupToken),
    refetchInterval: options?.refetchInterval,
    retry: false,
  });
};

/** Checkout público: REST, porque roda sem sessão e redireciona pro Stripe. */
export const useStartTrafegoCheckout = () => {
  return useMutation({
    mutationFn: async (body: TrafegoCheckoutBody) => {
      const response = await fetch("/api/checkout/trafego", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Não foi possível iniciar o pagamento.");
      }
      return data as { url: string; pendingId?: string };
    },
  });
};

export const useRedeemTrafegoPurchase = () => {
  return useMutation({
    mutationFn: (input: { signupToken: string }) =>
      client.trafego.redeemPurchase(input),
  });
};
