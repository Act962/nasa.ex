/**
 * Asaas API client — NASA Platform
 *
 * Asaas é uma fintech brasileira que suporta PIX, Boleto e Cartão.
 * Docs: https://docs.asaas.com
 *
 * Para ativar:
 *  1. Crie uma conta em asaas.com
 *  2. Vá em Configurações → Integrações → Gerar token
 *  3. Cole a chave em /admin/payments
 */

export const ASAAS_BASE = {
  production: "https://api.asaas.com/v3",
  sandbox:    "https://sandbox.asaas.com/api/v3",
} as const;

export type AsaasEnv = "production" | "sandbox";

// ─── Low-level fetch wrapper ──────────────────────────────────────────────────

async function asaasFetch<T>(
  apiKey: string,
  env: AsaasEnv,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const base = ASAAS_BASE[env];
  const res  = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { errors?: Array<{ description: string }> })
      ?.errors?.[0]?.description ?? `Asaas API error ${res.status}`;
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface AsaasCustomer {
  id:    string;
  name:  string;
  email: string;
}

export async function findOrCreateCustomer(
  apiKey: string,
  env: AsaasEnv,
  email: string,
  name: string,
): Promise<AsaasCustomer> {
  // Try to find existing
  const list = await asaasFetch<{ data: AsaasCustomer[] }>(
    apiKey, env,
    `/customers?email=${encodeURIComponent(email)}&limit=1`,
  );

  if (list.data.length > 0) return list.data[0];

  // Create new
  return asaasFetch<AsaasCustomer>(apiKey, env, "/customers", {
    method:  "POST",
    body:    JSON.stringify({ name, email }),
  });
}

// ─── Payment (charge) ─────────────────────────────────────────────────────────

export interface AsaasChargeInput {
  customerId:        string;
  billingType:       "UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD";
  value:             number;          // BRL (e.g. 29.90)
  dueDate:           string;          // YYYY-MM-DD
  description:       string;
  externalReference: string;          // StarsPayment.id
  callbackSuccessUrl?: string;
}

export interface AsaasCharge {
  id:             string;
  status:         string;
  value:          number;
  invoiceUrl:     string;  // payment page URL (links to form, PIX, boleto)
  bankSlipUrl:    string | null;
  pixQrCodeId:    string | null;
  externalReference: string;
}

export async function createCharge(
  apiKey: string,
  env: AsaasEnv,
  input: AsaasChargeInput,
): Promise<AsaasCharge> {
  return asaasFetch<AsaasCharge>(apiKey, env, "/payments", {
    method: "POST",
    body:   JSON.stringify({
      customer:          input.customerId,
      billingType:       input.billingType,
      value:             input.value,
      dueDate:           input.dueDate,
      description:       input.description,
      externalReference: input.externalReference,
      ...(input.callbackSuccessUrl ? { callback: { successUrl: input.callbackSuccessUrl } } : {}),
    }),
  });
}

// ─── PIX QR Code ─────────────────────────────────────────────────────────────

export interface AsaasPixQr {
  encodedImage: string;   // base64 PNG
  payload:      string;   // copy-paste code
  expirationDate: string;
}

export async function getPixQrCode(
  apiKey: string,
  env: AsaasEnv,
  chargeId: string,
): Promise<AsaasPixQr> {
  return asaasFetch<AsaasPixQr>(apiKey, env, `/payments/${chargeId}/pixQrCode`);
}

// ─── Due date helper ──────────────────────────────────────────────────────────

export function dueDatePlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── Payment lookup ───────────────────────────────────────────────────────────

export interface AsaasPayment {
  id:                string;
  status:            string;
  value:             number;
  netValue?:         number;
  billingType:       string;
  invoiceUrl:        string;
  externalReference: string | null;
  paymentDate?:      string | null;
  confirmedDate?:    string | null;
}

// Status em que o dinheiro já está garantido pra loja.
export const ASAAS_PAID_STATUSES = new Set([
  "RECEIVED",
  "CONFIRMED",
  "RECEIVED_IN_CASH",
]);

export async function getPayment(
  apiKey: string,
  env: AsaasEnv,
  paymentId: string,
): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(apiKey, env, `/payments/${paymentId}`);
}

// ─── Customer by document ─────────────────────────────────────────────────────

// Cobrança no Asaas exige cpfCnpj no customer — o lookup por documento evita
// duplicar o cliente a cada pedido.
export async function findOrCreateCustomerByDocument(
  apiKey: string,
  env: AsaasEnv,
  customer: { name: string; cpfCnpj: string; email?: string | null; phone?: string | null },
): Promise<AsaasCustomer> {
  const cpfCnpj = customer.cpfCnpj.replace(/\D/g, "");
  const list = await asaasFetch<{ data: AsaasCustomer[] }>(
    apiKey, env,
    `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`,
  );
  if (list.data.length > 0) return list.data[0];

  return asaasFetch<AsaasCustomer>(apiKey, env, "/customers", {
    method: "POST",
    body:   JSON.stringify({
      name: customer.name,
      cpfCnpj,
      ...(customer.email ? { email: customer.email } : {}),
      ...(customer.phone ? { mobilePhone: customer.phone } : {}),
      notificationDisabled: true,
    }),
  });
}

// ─── Account / webhooks ───────────────────────────────────────────────────────

export interface AsaasWebhook {
  id:   string;
  url:  string;
  name: string;
}

export async function getAccountInfo(
  apiKey: string,
  env: AsaasEnv,
): Promise<{ name: string | null; email: string | null }> {
  const account = await asaasFetch<{ name?: string; email?: string }>(
    apiKey, env, "/myAccount",
  );
  return { name: account.name ?? null, email: account.email ?? null };
}

const PAYMENT_WEBHOOK_EVENTS = [
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
];

export async function upsertPaymentWebhook(
  apiKey: string,
  env: AsaasEnv,
  input: { webhookId?: string | null; name: string; url: string; email: string; authToken: string },
): Promise<AsaasWebhook> {
  const body = JSON.stringify({
    name:        input.name,
    url:         input.url,
    email:       input.email,
    enabled:     true,
    interrupted: false,
    apiVersion:  3,
    authToken:   input.authToken,
    sendType:    "SEQUENTIALLY",
    events:      PAYMENT_WEBHOOK_EVENTS,
  });

  if (input.webhookId) {
    try {
      return await asaasFetch<AsaasWebhook>(apiKey, env, `/webhooks/${input.webhookId}`, {
        method: "PUT",
        body,
      });
    } catch {
      // Webhook apagado no painel do Asaas — cai pra criação.
    }
  }
  return asaasFetch<AsaasWebhook>(apiKey, env, "/webhooks", { method: "POST", body });
}
