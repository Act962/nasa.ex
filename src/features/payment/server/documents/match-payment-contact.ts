import "server-only";

import prisma from "@/lib/prisma";
import {
  documentDigits,
  normalizeContactName,
} from "@/features/payment/lib/documents/normalize-document";

// Procura o PaymentContact que corresponde à parte de um documento lido:
// primeiro pelo CNPJ/CPF (exato, só dígitos), depois pelo nome normalizado.

export interface ContactMatch {
  contactId: string;
  name: string;
  matchedBy: "document" | "name";
}

export async function matchPaymentContact(params: {
  organizationId: string;
  document: string | null;
  name: string | null;
}): Promise<ContactMatch | null> {
  const digits = documentDigits(params.document);

  if (digits) {
    const candidates = await prisma.paymentContact.findMany({
      where: { organizationId: params.organizationId, isActive: true, document: { not: null } },
      select: { id: true, name: true, document: true },
    });
    const byDocument = candidates.find((contact) => documentDigits(contact.document) === digits);
    if (byDocument) {
      return { contactId: byDocument.id, name: byDocument.name, matchedBy: "document" };
    }
  }

  if (params.name) {
    const target = normalizeContactName(params.name);
    if (target.length < 3) return null;
    const candidates = await prisma.paymentContact.findMany({
      where: { organizationId: params.organizationId, isActive: true },
      select: { id: true, name: true },
    });
    const byName = candidates.find((contact) => {
      const normalized = normalizeContactName(contact.name);
      return normalized === target || normalized.startsWith(target) || target.startsWith(normalized);
    });
    if (byName) return { contactId: byName.id, name: byName.name, matchedBy: "name" };
  }

  return null;
}
