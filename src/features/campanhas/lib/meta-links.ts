// Atalhos para o painel da Meta (spec 0040). O cliente cadastra o cartão e vê
// a fatura na própria conta; a ÓRBITA só leva ao lugar certo. Sem o portfólio
// (`business_id`), abre a página geral, que pede para escolher a empresa.

const BUSINESS_SUITE = "https://business.facebook.com";

function withBusiness(path: string, businessId?: string | null, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ ...(businessId ? { business_id: businessId } : {}), ...extra });
  const query = params.toString();
  return `${BUSINESS_SUITE}${path}${query ? `?${query}` : ""}`;
}

export interface MetaAccountRefs {
  businessId?: string | null;
  wabaId?: string | null;
}

/** Cadastrar ou trocar o cartão (Billing Hub → formas de pagamento). */
export function metaPaymentMethodsUrl(refs: MetaAccountRefs): string {
  return withBusiness("/billing_hub/payment_settings/", refs.businessId);
}

/** Faturas e cobranças do WhatsApp. */
export function metaBillingActivityUrl(refs: MetaAccountRefs): string {
  return withBusiness("/billing_hub/payment_activity/", refs.businessId);
}

/** WhatsApp Manager da conta (números, templates, limites). */
export function metaWhatsAppManagerUrl(refs: MetaAccountRefs): string {
  return withBusiness("/latest/whatsapp_manager/overview/", refs.businessId, refs.wabaId ? { asset_id: refs.wabaId } : {});
}

/** Verificação da empresa — é o que sobe o limite de 250 para 2.000 por dia. */
export function metaBusinessVerificationUrl(refs: MetaAccountRefs): string {
  return withBusiness("/settings/security/", refs.businessId);
}
