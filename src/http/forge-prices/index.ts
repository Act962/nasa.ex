// Adapters de busca de preços públicos para o Simulador do Forge.
//
// Cada fetcher normaliza uma fonte pública para `FetchedPrice[]`. O cron
// `forge-sync-price-suggestions` compara com o catálogo e cria SUGESTÕES
// (nunca sobrescreve). Fonte que falha é no-op — nunca derruba o cron.
//
// As páginas de preço são HTML instável/JS-rendered, então o parsing real de
// cada fonte é incremental: enquanto um fetcher não tem parser, ele retorna []
// (nenhuma sugestão), mantendo o pipeline seguro e registrado.

export interface FetchedPrice {
  category:
    | "AI_MODEL"
    | "WHATSAPP_CONVERSATION"
    | "INFRA_SERVER"
    | "HOSTING"
    | "STORAGE"
    | "DATABASE"
    | "LABOR"
    | "OTHER";
  code: string;
  name?: string;
  provider?: string;
  currency: "BRL" | "USD";
  unit?: string;
  unitPrice?: number;
  inputPer1k?: number;
  outputPer1k?: number;
  cachedInputPer1k?: number;
  sourceUrl: string;
  sourceLabel: string;
}

export interface PriceFetcher {
  key: string;
  run: () => Promise<FetchedPrice[]>;
}

const stub = (key: string, sourceUrl: string, sourceLabel: string): PriceFetcher => ({
  key,
  // Parser ainda não implementado — retorna vazio (no-op) até ter extração
  // estável para a fonte. `sourceUrl`/`sourceLabel` já ficam prontos.
  run: async () => {
    void sourceUrl;
    void sourceLabel;
    return [];
  },
});

export const PRICE_FETCHERS: PriceFetcher[] = [
  stub("openai", "https://openai.com/api/pricing/", "OpenAI Pricing"),
  stub("anthropic", "https://www.anthropic.com/pricing", "Anthropic Pricing"),
  stub("google", "https://ai.google.dev/pricing", "Google AI Pricing"),
  stub("meta-whatsapp", "https://developers.facebook.com/docs/whatsapp/pricing", "WhatsApp Pricing"),
  stub("cloudflare", "https://www.cloudflare.com/plans/", "Cloudflare Plans"),
  stub("neon", "https://neon.com/pricing", "Neon Pricing"),
];
