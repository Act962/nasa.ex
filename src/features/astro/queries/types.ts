import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroTablePayload } from "@/features/astro/lib/astro-table";

/**
 * Consultas que o Astro responde em código, sem IA.
 *
 * "Quantos leads temos?" chegava ao orquestrador, gastava 43 mil tokens e
 * voltava "não tenho acesso aos dados": diante de ~91 ferramentas, o modelo
 * respondia sem chamar nenhuma. Contar linha em tabela é `count()`.
 *
 * Cada consulta é um par frase→query. Não há classificador aqui: se o texto
 * casa, responde; se não casa, o pedido segue o caminho de sempre.
 */

export interface AstroQueryResult {
  text: string;
  table?: AstroTablePayload;
}

/** O que a consulta recebe. `history` já vem sem acento e em minúsculas. */
export interface AstroQueryParams {
  ctx: AgentContext;
  /** Texto do usuário, normalizado. */
  text: string;
  /** Turnos anteriores, normalizados e concatenados. */
  history: string;
}

export interface AstroQuery {
  key: string;
  /** App a que pertence — serve ao inventário e ao relatório de cobertura. */
  app: string;
  /** Recebe o texto normalizado e a conversa até aqui. */
  matches: (normalizedText: string, normalizedHistory: string) => boolean;
  run: (params: AstroQueryParams) => Promise<AstroQueryResult | null>;
}

/** "deles", "dessas", "isso" — o pedido se apoia no turno anterior. */
export const REFERS_BACK = /\b(deles|delas|desses|dessas|disso|dele|dela|eles|elas|mesmos?)\b/;

/** Recorte de tempo dito na frase, ou herdado do turno anterior. */
export function periodFrom(text: string): { since: Date; label: string } | null {
  if (/\bhoje\b/.test(text)) return { since: startOfToday(), label: "hoje" };
  if (/\bontem\b/.test(text)) {
    const since = new Date(startOfToday().getTime() - 24 * 60 * 60_000);
    return { since, label: "ontem" };
  }
  if (/\b(essa|esta|nesta|na) semana|ultimos 7 dias\b/.test(text)) {
    return { since: new Date(startOfToday().getTime() - 7 * 24 * 60 * 60_000), label: "nos últimos 7 dias" };
  }
  if (/\b(esse|este|neste|no) mes\b/.test(text)) {
    return { since: startOfMonth(), label: "neste mês" };
  }
  return null;
}

export function normalizeQuestion(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** "Quantos", "quais", "liste", "me mostra" — o pedido é de leitura. */
export const ASKS = /\b(quantos|quantas|quais|que|liste|lista|listar|me mostra|mostra|tem quantos|total de|qual o total|qual a quantidade)\b/;

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** Centavos → "R$ 1.234,56". */
export function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
