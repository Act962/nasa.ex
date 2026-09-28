import "server-only";
import { isValidDateValue } from "@/features/payment/lib/dates";

// Datas das propostas financeiras: o Astro recebe "hoje", "amanhã" ou
// AAAA-MM-DD, sempre no fuso de São Paulo.

export function todayIsoInSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 10);
}

export function resolveDateIso(value: string | undefined): string | { error: string } {
  if (!value) return todayIsoInSaoPaulo();
  const lower = value.toLowerCase().trim();
  if (lower === "hoje" || lower === "today") return todayIsoInSaoPaulo();
  if (lower === "amanhã" || lower === "amanha" || lower === "tomorrow") {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return tomorrow.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 10);
  }
  const iso = value.length >= 10 ? value.slice(0, 10) : value;
  if (!isValidDateValue(iso)) {
    return { error: `Data inválida: "${value}". Use AAAA-MM-DD, 'hoje' ou 'amanhã'.` };
  }
  return iso;
}
