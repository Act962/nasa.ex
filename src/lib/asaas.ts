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
  // `sandbox.asaas.com/api/v3` é o host legado: ainda responde, mas só este
  // aparece na documentação atual.
  sandbox:    "https://api-sandbox.asaas.com/v3",
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
  id:       string;
  name:     string;
  email:    string;
  cpfCnpj?: string;
}

export interface FindOrCreateCustomerInput {
  email: string;
  name:  string;
  /**
   * CPF ou CNPJ, só dígitos. A API do Asaas o exige para CRIAR pagador — sem
   * ele, só é possível reaproveitar alguém já cadastrado.
   */
  cpfCnpj:            string | null;
  phone?:             string | null;
  externalReference?: string | null;
}

/**
 * Busca primeiro pelo documento, que é a identidade real do pagador no Asaas;
 * o e-mail muda, o CPF não. Cai para o e-mail quando não há documento.
 */
export async function findOrCreateCustomer(
  apiKey: string,
  env: AsaasEnv,
  input: FindOrCreateCustomerInput,
): Promise<AsaasCustomer> {
  const documentDigits = input.cpfCnpj?.replace(/\D/g, "") ?? null;

  const query = documentDigits
    ? `cpfCnpj=${documentDigits}`
    : `email=${encodeURIComponent(input.email)}`;

  const existing = await asaasFetch<{ data: AsaasCustomer[] }>(
    apiKey, env,
    `/customers?${query}&limit=1`,
  );
  if (existing.data.length > 0) return existing.data[0];

  if (!documentDigits) {
    // Falha explícita em vez de um 400 cru vindo do Asaas: sem documento o
    // cadastro é impossível, e a mensagem precisa dizer isso a quem lê o log.
    throw new Error(
      "Asaas exige CPF ou CNPJ para cadastrar um novo pagador.",
    );
  }

  return asaasFetch<AsaasCustomer>(apiKey, env, "/customers", {
    method: "POST",
    body:   JSON.stringify({
      name:     input.name,
      email:    input.email,
      cpfCnpj:  documentDigits,
      ...(input.phone ? { mobilePhone: input.phone.replace(/\D/g, "") } : {}),
      ...(input.externalReference
        ? { externalReference: input.externalReference }
        : {}),
    }),
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

/**
 * Situação da cobrança. `CONFIRMED` é dinheiro pago mas ainda não liberado na
 * conta; `RECEIVED` é saldo disponível. PIX pula o `CONFIRMED` e vai direto
 * para `RECEIVED`.
 */
export type AsaasPaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "RECEIVED"
  | "RECEIVED_IN_CASH"
  | "OVERDUE"
  | "REFUNDED"
  | "REFUND_REQUESTED"
  | "CHARGEBACK_REQUESTED"
  | "CHARGEBACK_DISPUTE"
  | "AWAITING_CHARGEBACK_REVERSAL"
  | "DELETED";

export interface AsaasPayment {
  id:                string;
  status:            AsaasPaymentStatus;
  billingType:       string;
  /** Valor da cobrança em BRL (ex.: 1850.00). */
  value:             number;
  /** Líquido após a taxa do Asaas — informativo, não é o que o cliente pagou. */
  netValue:          number | null;
  externalReference: string | null;
  customer:          string | null;
  dueDate:           string | null;
  paymentDate:       string | null;
  invoiceUrl:        string | null;
  /** Cobrança removida no painel do Asaas. */
  deleted:           boolean;
}

/**
 * Relê a cobrança na API. É a fonte de verdade do valor: o corpo do webhook
 * pode vir enxuto (só o id) e, mesmo completo, é entrada não confiável.
 */
export async function getPayment(
  apiKey: string,
  env: AsaasEnv,
  paymentId: string,
): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(apiKey, env, `/payments/${paymentId}`);
}

export interface AsaasPaymentList {
  data:       AsaasPayment[];
  hasMore:    boolean;
  totalCount: number;
}

/**
 * Busca cobranças pelo identificador do NOSSO lado. Serve para reencontrar uma
 * cobrança cujo vínculo não chegou a ser gravado — o POST foi aceito, o update
 * seguinte falhou, e o id ficou só no Asaas.
 */
export async function findPaymentsByExternalReference(
  apiKey: string,
  env: AsaasEnv,
  externalReference: string,
): Promise<AsaasPaymentList> {
  return asaasFetch<AsaasPaymentList>(
    apiKey, env,
    `/payments?externalReference=${encodeURIComponent(externalReference)}&limit=10`,
  );
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
