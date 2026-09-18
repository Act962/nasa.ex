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

/** Dados da cobrança PIX devolvidos pelo checkout quando o cliente escolhe PIX. */
export interface TrafegoPixCharge {
  /** Chave estática da agência. Null quando a cobrança saiu pelo Asaas. */
  key: string | null;
  holderName: string | null;
  bankName: string | null;
  reference: string;
  amountBrlCents: number;
  expiresAt: string;
  supportWhatsapp: string | null;
  receiptMessage: string;
  /** Copia-e-cola do QR. Null quando a cobrança não saiu pelo Asaas. */
  qrPayload: string | null;
  /** PNG em base64, sem o prefixo `data:`. */
  qrImageBase64: string | null;
  invoiceUrl: string | null;
  /**
   * True quando o pagamento se confirma sozinho pelo webhook. False significa
   * o fluxo antigo: pagar na chave e mandar o comprovante para a equipe.
   */
  autoConfirms: boolean;
}

export type TrafegoCheckoutResult =
  | { paymentMethod: "CARD"; url: string; pendingId?: string }
  | { paymentMethod: "PIX"; pendingId: string; pix: TrafegoPixCharge };

/**
 * Checkout público: REST, porque roda sem sessão. No cartão devolve a URL do
 * Stripe para redirecionar; no PIX devolve a chave e a referência, e quem
 * espera o comprovante é a equipe.
 */
export const useStartTrafegoCheckout = () => {
  return useMutation({
    mutationFn: async (body: TrafegoCheckoutBody): Promise<TrafegoCheckoutResult> => {
      const response = await fetch("/api/checkout/trafego", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as Partial<TrafegoCheckoutResult> & {
        error?: string;
        url?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível iniciar o pagamento.");
      }
      if (data.paymentMethod === "PIX") {
        if (!data.pix || !data.pendingId) {
          throw new Error("Não foi possível gerar a cobrança PIX.");
        }
        return { paymentMethod: "PIX", pendingId: data.pendingId, pix: data.pix };
      }
      if (!data.url) {
        throw new Error(data.error ?? "Não foi possível iniciar o pagamento.");
      }
      return { paymentMethod: "CARD", url: data.url, pendingId: data.pendingId };
    },
  });
};

export const useRedeemTrafegoPurchase = () => {
  return useMutation({
    mutationFn: (input: { signupToken: string }) =>
      client.trafego.redeemPurchase(input),
  });
};
