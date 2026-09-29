export const LEDGER_TYPE_LABELS: Record<string, string> = {
  EARN: "Compra",
  REDEEM: "Resgate",
  ADJUST_CREDIT: "Crédito manual",
  ADJUST_DEBIT: "Débito manual",
  EXPIRE: "Expirou",
  REVERSAL: "Estorno",
};

export const REWARD_TYPE_LABELS: Record<string, string> = {
  PRODUCT: "Produto",
  DISCOUNT: "Desconto",
  PRIZE: "Prêmio",
};

export const REDEMPTION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Aguardando aprovação",
  APPROVED: "Aprovado — a entregar",
  DELIVERED: "Entregue",
  REJECTED: "Recusado",
  CANCELED: "Cancelado",
};

export const REDEMPTION_CHANNEL_LABELS: Record<string, string> = {
  CONSULTANT: "Consultor",
  CHAT: "Chat",
  ASTRO: "Astro",
  PORTAL: "Portal do cliente",
};

export const ACTOR_TYPE_LABELS: Record<string, string> = {
  USER: "Usuário",
  SYSTEM: "Automático",
  ASTRO: "Astro",
  CUSTOMER: "Cliente",
};

export function formatStars(stars: number): string {
  return `${stars > 0 ? "+" : ""}${stars} ${Math.abs(stars) === 1 ? "star" : "stars"}`;
}

export type SnapshotItems = { purchase?: string; items?: { name: string; quantity: number }[]; name?: string };

export function describeSnapshot(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object") return "";
  const data = snapshot as SnapshotItems;
  if (data.items?.length) {
    const itemsText = data.items.map((item) => `${item.quantity}x ${item.name}`).join(", ");
    return data.purchase ? `${data.purchase}: ${itemsText}` : itemsText;
  }
  return data.name ?? data.purchase ?? "";
}
