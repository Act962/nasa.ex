import "server-only";
import prisma from "@/lib/prisma";
import {
  createCharge,
  findOrCreateCustomer,
  getPixQrCode,
  type AsaasEnv,
} from "@/lib/asaas";

export interface CreateAsaasPixChargeInput {
  pendingId: string;
  secretKey: string;
  environment: AsaasEnv;
  email: string;
  payerName: string;
  payerDocument: string;
  phone: string | null;
  amountBrlCents: number;
  expiresAt: Date;
  description: string;
}

export interface AsaasPixChargeResult {
  paymentId: string;
  customerId: string;
  /** Copia-e-cola. Null quando o QR falhou — a cobrança continua válida. */
  payload: string | null;
  /** PNG em base64, sem o prefixo `data:`. */
  encodedImage: string | null;
  invoiceUrl: string | null;
}

/**
 * Emite a cobrança PIX no Asaas e guarda o vínculo na pendência.
 *
 * O `externalReference` é o id da pendência: é por ele que o webhook reencontra
 * a compra. A falha do QR não desfaz a cobrança — ela já existe e é pagável
 * pelo `invoiceUrl`; recriar geraria cobrança duplicada.
 */
export async function createAsaasPixCharge(
  input: CreateAsaasPixChargeInput,
): Promise<AsaasPixChargeResult> {
  const customer = await findOrCreateCustomer(input.secretKey, input.environment, {
    email: input.email,
    name: input.payerName,
    cpfCnpj: input.payerDocument,
    phone: input.phone,
    externalReference: input.pendingId,
  });

  const charge = await createCharge(input.secretKey, input.environment, {
    customerId: customer.id,
    billingType: "PIX",
    value: input.amountBrlCents / 100,
    dueDate: toIsoDate(input.expiresAt),
    description: input.description,
    externalReference: input.pendingId,
  });

  let payload: string | null = null;
  let encodedImage: string | null = null;
  try {
    const qrCode = await getPixQrCode(
      input.secretKey,
      input.environment,
      charge.id,
    );
    payload = qrCode.payload;
    encodedImage = qrCode.encodedImage;
  } catch (error) {
    console.error(
      `[trafego/asaas] QR falhou para ${charge.id} — cobrança segue válida:`,
      error,
    );
  }

  await prisma.trafegoPendingPurchase.update({
    where: { id: input.pendingId },
    data: {
      asaasPaymentId: charge.id,
      asaasCustomerId: customer.id,
      payerDocument: input.payerDocument.replace(/\D/g, ""),
      pixQrCodePayload: payload,
    },
  });

  return {
    paymentId: charge.id,
    customerId: customer.id,
    payload,
    encodedImage,
    invoiceUrl: charge.invoiceUrl ?? null,
  };
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
