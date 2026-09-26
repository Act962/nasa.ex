import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import {
  ASAAS_PAID_STATUSES,
  createCharge,
  dueDatePlus,
  findOrCreateCustomerByDocument,
  getPayment,
  getPixQrCode,
} from "@/lib/asaas";
import type { CatalogOrderPaymentMethod } from "@/generated/prisma/enums";
import type { CatalogOrderCustomer } from "../schemas/order-payload";
import { loadAsaasCredentials } from "./integration-config";
import { confirmCatalogOrderPayment, resendNerpSyncIfPending } from "./confirm-payment";

export const CATALOG_ORDER_REFERENCE_PREFIX = "catalog-order:";
export const CATALOG_ORDER_PAYMENT_CREATED_EVENT = "nerp/catalog-order.payment-created";

const SETTLED_STATUSES = ["PAID", "IN_LOGISTICS", "DELIVERED", "CANCELED"] as const;

export function toCatalogOrderReference(orderId: string): string {
  return `${CATALOG_ORDER_REFERENCE_PREFIX}${orderId}`;
}

export function parseCatalogOrderReference(reference: string | null | undefined): string | null {
  if (!reference?.startsWith(CATALOG_ORDER_REFERENCE_PREFIX)) return null;
  return reference.slice(CATALOG_ORDER_REFERENCE_PREFIX.length) || null;
}

export class CatalogOrderPaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogOrderPaymentError";
  }
}

async function loadPayableOrder(orderId: string) {
  const order = await prisma.catalogOrder.findUniqueOrThrow({ where: { id: orderId } });
  if ((SETTLED_STATUSES as readonly string[]).includes(order.status)) {
    throw new CatalogOrderPaymentError(`Pedido já está ${order.status}.`);
  }
  return order;
}

function readCustomer(order: { customer: unknown }): CatalogOrderCustomer {
  return order.customer as CatalogOrderCustomer;
}

async function chargeOrder(
  orderId: string,
  method: CatalogOrderPaymentMethod,
  documentOverride?: string | null,
) {
  const order = await loadPayableOrder(orderId);
  const customer = readCustomer(order);
  const cpfCnpj = (documentOverride ?? customer.document ?? "").replace(/\D/g, "");
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    throw new CatalogOrderPaymentError(
      "CPF ou CNPJ do cliente é obrigatório para gerar a cobrança.",
    );
  }

  const credentials = await loadAsaasCredentials(order.organizationId);
  const asaasCustomer = await findOrCreateCustomerByDocument(credentials.apiKey, credentials.env, {
    name: customer.name,
    cpfCnpj,
    email: customer.email,
    phone: customer.phone,
  });
  const charge = await createCharge(credentials.apiKey, credentials.env, {
    customerId: asaasCustomer.id,
    billingType: method === "PIX" ? "PIX" : "UNDEFINED",
    value: Number(order.total),
    dueDate: dueDatePlus(1),
    description: `Pedido #${order.nerpSaleNumber} — Catálogo online`,
    externalReference: toCatalogOrderReference(order.id),
  });

  return { order, customer, cpfCnpj, charge, credentials };
}

async function startPaymentWatch(orderId: string, asaasPaymentId: string) {
  await inngest.send({
    name: CATALOG_ORDER_PAYMENT_CREATED_EVENT,
    data: { orderId, asaasPaymentId },
  });
}

export async function createOrderPixCharge(orderId: string, documentOverride?: string | null) {
  const { order, customer, cpfCnpj, charge, credentials } = await chargeOrder(
    orderId,
    "PIX",
    documentOverride,
  );
  const pix = await getPixQrCode(credentials.apiKey, credentials.env, charge.id);

  await prisma.catalogOrder.update({
    where: { id: order.id },
    data: {
      status: "AWAITING_PAYMENT",
      paymentMethod: "PIX",
      asaasPaymentId: charge.id,
      pixPayload: pix.payload,
      pixQrImage: pix.encodedImage,
      pixExpiresAt: pix.expirationDate ? new Date(pix.expirationDate) : null,
      invoiceUrl: charge.invoiceUrl,
      customer: { ...customer, document: cpfCnpj },
    },
  });
  await startPaymentWatch(order.id, charge.id);

  return {
    pixCopyPaste: pix.payload,
    expiresAt: pix.expirationDate,
    total: Number(order.total),
    invoiceUrl: charge.invoiceUrl,
  };
}

export async function createOrderPaymentLink(orderId: string, documentOverride?: string | null) {
  const { order, customer, cpfCnpj, charge } = await chargeOrder(
    orderId,
    "ASAAS_LINK",
    documentOverride,
  );

  await prisma.catalogOrder.update({
    where: { id: order.id },
    data: {
      status: "AWAITING_PAYMENT",
      paymentMethod: "ASAAS_LINK",
      asaasPaymentId: charge.id,
      pixPayload: null,
      pixQrImage: null,
      pixExpiresAt: null,
      invoiceUrl: charge.invoiceUrl,
      customer: { ...customer, document: cpfCnpj },
    },
  });
  await startPaymentWatch(order.id, charge.id);

  return { invoiceUrl: charge.invoiceUrl, total: Number(order.total) };
}

// Consulta direta no Asaas — rede de segurança do webhook e ferramenta do
// Astro quando o cliente diz "já paguei".
export async function refreshOrderPaymentStatus(orderId: string) {
  const order = await prisma.catalogOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { id: true, organizationId: true, asaasPaymentId: true, status: true },
  });
  if (!order.asaasPaymentId) return { isPaid: false, asaasStatus: null };
  if ((SETTLED_STATUSES as readonly string[]).includes(order.status)) {
    await resendNerpSyncIfPending(order.id);
    return { isPaid: order.status !== "CANCELED", asaasStatus: order.status };
  }

  const credentials = await loadAsaasCredentials(order.organizationId);
  const payment = await getPayment(credentials.apiKey, credentials.env, order.asaasPaymentId);
  const isPaid = ASAAS_PAID_STATUSES.has(payment.status);
  if (isPaid) {
    await confirmCatalogOrderPayment(order.id, {
      asaasPaymentId: payment.id,
      amount: payment.value,
      billingType: payment.billingType,
      paidAt: payment.confirmedDate ?? payment.paymentDate ?? null,
    });
  }
  return { isPaid, asaasStatus: payment.status };
}
