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

export interface AstroQuery {
  key: string;
  /** App a que pertence — serve ao inventário e ao relatório de cobertura. */
  app: string;
  /** Recebe o texto já sem acento e em minúsculas. */
  matches: (normalizedText: string) => boolean;
  run: (ctx: AgentContext) => Promise<AstroQueryResult | null>;
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
