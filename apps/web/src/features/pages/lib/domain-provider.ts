/**
 * Abstração de registrador de domínios.
 * MVP: implementação mock que permite testar o fluxo completo localmente.
 * Em produção, configure DOMAIN_PROVIDER=namecheap|godaddy|registrobr
 * + DOMAIN_PROVIDER_API_KEY/DOMAIN_PROVIDER_API_SECRET.
 */

export interface DomainSearchResult {
  domain: string;
  available: boolean;
  priceCents: number | null;
  currency: string;
}

export interface StartPurchaseArgs {
  domain: string;
  returnUrl?: string;
  organizationId: string;
}

export interface StartPurchaseResult {
  provider: string;
  checkoutUrl: string;
  externalOrderId: string;
  priceCents: number | null;
  currency: string;
}

export interface PurchaseStatusResult {
  status:
    | "NOT_STARTED"
    | "SEARCHING"
    | "AWAITING_PAYMENT"
    | "PAID"
    | "REGISTERING"
    | "ACTIVE"
    | "FAILED";
  lastError?: string;
}

interface IDomainProvider {
  name: string;
  search(query: string, tlds: string[]): Promise<DomainSearchResult[]>;
  startPurchase(args: StartPurchaseArgs): Promise<StartPurchaseResult>;
  getStatus(externalOrderId: string): Promise<PurchaseStatusResult>;
}

const mockProvider: IDomainProvider = {
  name: "mock",
  async search(query, tlds) {
    const clean = query.toLowerCase().replace(/[^a-z0-9-]/g, "");
    return tlds.map((tld) => ({
      domain: `${clean}${tld}`,
      available: Math.random() > 0.3,
      priceCents: 3990 + Math.floor(Math.random() * 6000),
      currency: "BRL",
    }));
  },
  async startPurchase({ domain, returnUrl, organizationId }) {
    const externalOrderId = `mock_${Date.now()}_${organizationId.slice(-4)}`;
    const checkoutUrl = new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    );
    checkoutUrl.pathname = "/pages/mock-checkout";
    checkoutUrl.searchParams.set("order", externalOrderId);
    checkoutUrl.searchParams.set("domain", domain);
    if (returnUrl) checkoutUrl.searchParams.set("return", returnUrl);
    return {
      provider: "mock",
      checkoutUrl: checkoutUrl.toString(),
      externalOrderId,
      priceCents: 4990,
      currency: "BRL",
    };
  },
  async getStatus(_externalOrderId: string) {
    return { status: "AWAITING_PAYMENT" as const };
  },
};

function getProvider(): IDomainProvider {
  return mockProvider;
}

export async function searchDomains(query: string, tlds: string[]) {
  return getProvider().search(query, tlds);
}

export async function startDomainPurchase(args: StartPurchaseArgs) {
  return getProvider().startPurchase(args);
}

export async function getDomainPurchaseStatus(externalOrderId: string) {
  return getProvider().getStatus(externalOrderId);
}
