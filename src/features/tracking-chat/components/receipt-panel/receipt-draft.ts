import { unmaskMoney } from "@/utils/mask-money";
import type { SaleReceiptData } from "@/features/forge/components/public/sale-receipt";
import type { SalePaymentMethod } from "@/features/forge/lib/sale-payment";

export interface ReceiptItemDraft {
  /** Preenchido quando o item veio do catálogo; vazio = digitado na hora (vira produto ao emitir). */
  productId: string;
  name: string;
  quantity: number;
  unitValue: string;
  discountPerUnit: string;
}

export interface ReceiptClientDraft {
  name: string;
  /** Só usado quando o lead não tem telefone: digitado pelo atendente (spec 0151, RF-3). */
  phone: string;
  document: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface ReceiptDraft {
  client: ReceiptClientDraft;
  items: ReceiptItemDraft[];
  paymentMethod: SalePaymentMethod;
  installments: number;
}

export type ReceiptOrganization = SaleReceiptData["organization"];

const MIN_PHONE_DIGITS = 10;

export const EMPTY_RECEIPT_ITEM: ReceiptItemDraft = { productId: "", name: "", quantity: 1, unitValue: "R$ 0,00", discountPerUnit: "R$ 0,00" };

export const maskedToReais = (masked: string) => unmaskMoney(masked) / 100;

export function receiptTotal(items: ReceiptItemDraft[]): number {
  return items.reduce((sum, item) => sum + item.quantity * (maskedToReais(item.unitValue) - maskedToReais(item.discountPerUnit)), 0);
}

/** O que impede emitir, em palavras do atendente; `null` quando está tudo certo (spec 0151, casos de borda). */
export function receiptBlocker(draft: ReceiptDraft): string | null {
  if (!draft.client.name.trim()) return "Informe o nome do cliente.";
  const phoneDigits = draft.client.phone.replace(/\D/g, "");
  if (phoneDigits && phoneDigits.length < MIN_PHONE_DIGITS) return "WhatsApp incompleto: confira o DDD e o número.";
  if (draft.items.some((item) => !item.name.trim())) return "Dê um nome a cada item.";
  if (draft.items.some((item) => maskedToReais(item.unitValue) <= 0)) return "Cada item precisa de um preço.";
  if (draft.items.some((item) => maskedToReais(item.discountPerUnit) > maskedToReais(item.unitValue))) {
    return "O desconto não pode ser maior que o preço.";
  }
  return null;
}

function clientAddressLine(client: ReceiptClientDraft): string | null {
  const line = [
    [client.street, client.number].map((part) => part.trim()).filter(Boolean).join(", "),
    client.neighborhood.trim(),
    [client.city, client.state].map((part) => part.trim()).filter(Boolean).join(" - "),
  ]
    .filter(Boolean)
    .join(", ");
  return line || null;
}

export function toReceiptPreview(draft: ReceiptDraft, organization: ReceiptOrganization): SaleReceiptData {
  return {
    number: null,
    paidAt: new Date().toISOString(),
    paymentMethod: draft.paymentMethod,
    installments: draft.paymentMethod === "CREDITO" ? draft.installments : null,
    proposalDiscount: 0,
    organization,
    client: { name: draft.client.name.trim() || "Cliente", document: draft.client.document.trim() || null, address: clientAddressLine(draft.client) },
    items: draft.items.map((item) => ({
      name: item.name.trim() || "Item",
      description: null,
      quantity: item.quantity,
      unitValue: maskedToReais(item.unitValue),
      discount: item.quantity * maskedToReais(item.discountPerUnit),
    })),
  };
}

export function toRegisterSaleInput(draft: ReceiptDraft, leadId: string) {
  const { client } = draft;
  return {
    leadId,
    name: client.name.trim(),
    phone: client.phone.replace(/\D/g, "") || undefined,
    document: client.document.trim() || undefined,
    address: { street: client.street, number: client.number, neighborhood: client.neighborhood, city: client.city, state: client.state },
    items: draft.items.map((item) => ({
      ...(item.productId ? { productId: item.productId } : { productName: item.name.trim() }),
      quantity: item.quantity,
      unitValue: maskedToReais(item.unitValue),
      discountPerUnit: maskedToReais(item.discountPerUnit),
    })),
    paymentMethod: draft.paymentMethod,
    installments: draft.paymentMethod === "CREDITO" ? draft.installments : undefined,
  };
}

export function receiptMessage(clientName: string, receiptUrl: string): string {
  const firstName = clientName.trim().split(/\s+/)[0] ?? "";
  return `Olá${firstName ? `, ${firstName}` : ""}! Segue o seu recibo: ${receiptUrl}`;
}
