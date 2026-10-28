import "server-only";

import prisma from "@/lib/prisma";

// Cliente de uma cobrança (spec 0115): contato do financeiro ou lead do funil, numa busca
// só. O lead é ligado direto, sem cópia no financeiro. Leads seguem a mesma regra da busca
// de leads: só dos trackings em que o usuário participa.

const RESULTS_PER_KIND = 8;

export type PaymentCustomerOption = {
  kind: "contact" | "lead";
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  /** Nome do tracking, para o lead. */
  origin: string | null;
};

export async function searchPaymentCustomers(params: {
  organizationId: string;
  userId: string;
  search?: string;
}): Promise<PaymentCustomerOption[]> {
  const search = params.search?.trim();
  const textFilter = search
    ? [
        { name: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search.replace(/\D/g, "") || search } },
      ]
    : undefined;

  const [contacts, leads] = await Promise.all([
    prisma.paymentContact.findMany({
      where: {
        organizationId: params.organizationId,
        isActive: true,
        contactType: { in: ["CUSTOMER", "BOTH"] },
        ...(textFilter ? { OR: textFilter } : {}),
      },
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { name: "asc" },
      take: RESULTS_PER_KIND,
    }),
    prisma.lead.findMany({
      where: {
        isArchived: false,
        tracking: {
          organizationId: params.organizationId,
          participants: { some: { userId: params.userId } },
        },
        ...(textFilter ? { OR: textFilter } : {}),
      },
      select: { id: true, name: true, phone: true, email: true, tracking: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: RESULTS_PER_KIND,
    }),
  ]);

  return [
    ...contacts.map((contact) => ({
      kind: "contact" as const,
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      origin: null,
    })),
    ...leads.map((lead) => ({
      kind: "lead" as const,
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      origin: lead.tracking.name,
    })),
  ];
}
