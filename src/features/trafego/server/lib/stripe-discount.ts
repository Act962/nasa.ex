import "server-only";
import { getStripe } from "@/lib/stripe";

/**
 * Desconto de cupom de uma compra no cartão, lido do Stripe (spec 0010 §5.2,
 * alternativa sem migration). Sem sessão nem PaymentIntent — PIX ou pedido
 * avulso — não há cupom: devolve 0. Devolve `null` só quando o Stripe não
 * respondeu, para o chamador distinguir "sem desconto" de "não sei".
 */
export async function fetchTrafegoStripeDiscountCents(ids: {
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
}): Promise<number | null> {
  if (!ids.checkoutSessionId && !ids.paymentIntentId) return 0;

  try {
    const stripe = getStripe();
    const session = ids.checkoutSessionId
      ? await stripe.checkout.sessions.retrieve(ids.checkoutSessionId)
      : (
          await stripe.checkout.sessions.list({
            payment_intent: ids.paymentIntentId!,
            limit: 1,
          })
        ).data[0];
    return session?.total_details?.amount_discount ?? 0;
  } catch (error) {
    console.error("[trafego/stripe-discount] leitura do desconto falhou:", error);
    return null;
  }
}
