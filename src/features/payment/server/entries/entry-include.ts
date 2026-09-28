import "server-only";

// Shape compartilhado dos lançamentos devolvidos pelas procedures e pelos
// serviços — o `include` é um só para que Astro e tela vejam o mesmo objeto.

export const ENTRY_INCLUDE = {
  category: { select: { id: true, name: true, type: true, color: true } },
  contact: { select: { id: true, name: true, contactType: true } },
  account: { select: { id: true, name: true, type: true } },
  approvalRequest: {
    select: {
      id: true,
      status: true,
      requestedById: true,
      requestedAt: true,
      decidedAt: true,
    },
  },
} as const;

export const PENDING_ENTRY_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"] as const;

export interface PaymentActor {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/** Centavos → "R$ 1.500,00". Os valores do módulo são sempre inteiros em centavos. */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
