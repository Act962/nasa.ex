/**
 * Fontes oficiais das regras. Cada item guarda a data em que a equipe revisou
 * o texto — política de plataforma muda, e regra sem data de revisão vira
 * lenda. Ao revisar, atualize `reviewedAt` e registre no changelog do
 * `docs/trafego-overview.md`.
 */

export interface PolicySource {
  id: string;
  label: string;
  url: string;
  /** Última conferência humana do conteúdo (AAAA-MM-DD). */
  reviewedAt: string;
}

export const POLICY_SOURCES: PolicySource[] = [
  {
    id: "meta-ad-standards",
    label: "Padrões de Publicidade da Meta",
    url: "https://transparency.meta.com/pt-br/policies/ad-standards/",
    reviewedAt: "2026-09-12",
  },
  {
    id: "meta-ads-guide",
    label: "Guia de anúncios da Meta",
    url: "https://www.facebook.com/business/ads-guide",
    reviewedAt: "2026-09-12",
  },
  {
    id: "google-ads-policies",
    label: "Políticas do Google Ads",
    url: "https://support.google.com/adspolicy/answer/54818?hl=pt-br",
    reviewedAt: "2026-09-12",
  },
  {
    id: "google-ads-product-terms",
    label: "Termos do produto Google Ads",
    url: "https://transparency.google/intl/pt-BR_ALL/our-policies/product-terms/google-ads/",
    reviewedAt: "2026-09-12",
  },
  {
    id: "google-ads-brasil",
    label: "Termos e condições do Google Ads (Brasil)",
    url: "https://www.google.com/intl/pt-BR/adwords/select/TCBrazilForGoogleBrazil1108.html",
    reviewedAt: "2026-09-12",
  },
  {
    id: "whatsapp-business-policy",
    label: "Política de Mensagens Comerciais do WhatsApp",
    url: "https://business.whatsapp.com/policy",
    reviewedAt: "2026-09-12",
  },
];

export function sourceUrl(id: string): string {
  return POLICY_SOURCES.find((source) => source.id === id)?.url ?? "";
}
