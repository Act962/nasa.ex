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
