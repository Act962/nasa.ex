// Rótulos da subaba Créditos, em linguagem de dono de empresa.

export type CreditStatusDisplay = "PENDING_PAYMENT" | "AVAILABLE" | "USED" | "GLOSSED";

export const CREDIT_STATUS_LABELS: Record<CreditStatusDisplay, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  AVAILABLE: "Disponível",
  USED: "Já usado",
  GLOSSED: "Perdido (compra cancelada)",
};

export const CREDIT_STATUS_TONES: Record<CreditStatusDisplay, string> = {
  PENDING_PAYMENT: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  AVAILABLE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  USED: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  GLOSSED: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
};

/** Link para a aba Despesa do financeiro (o onNavigate da aba Contábil não cobre abas do Payment). */
export const PAYABLES_TAB_HREF = "/payment?tab=payables";

export function formatDocument(document: string | null): string {
  if (!document) return "";
  if (document.length === 14) {
    return document.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (document.length === 11) {
    return document.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return document;
}
