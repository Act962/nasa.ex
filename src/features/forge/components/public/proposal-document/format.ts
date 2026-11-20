import type { DocumentProposal } from "./types";

export function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(iso: string | null): string | null {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : null;
}

export function proposalNumberLabel(number: number): string {
  return String(number).padStart(4, "0");
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Telefone da empresa em formato wa.me (com 55); nulo quando não dá para ligar. */
export function companyWhatsappLink(proposal: DocumentProposal): string | null {
  const digits = (proposal.organization.contactPhone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  const message = `Olá! Vi a proposta nº ${proposalNumberLabel(proposal.number)} e quero conversar.`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}
