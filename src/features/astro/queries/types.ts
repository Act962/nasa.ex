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
  /**
   * Chave na matriz de permissões (Settings › Permissões). Sem `canView`
   * nela, a consulta não roda: "quanto tenho a receber" respondia para
   * qualquer membro da organização, tivesse ou não acesso ao financeiro.
   */
  appKey: string;
  /** Recebe o texto normalizado e a conversa até aqui. */
  matches: (normalizedText: string, normalizedHistory: string) => boolean;
  run: (params: AstroQueryParams) => Promise<AstroQueryResult | null>;
}

/** "deles", "dessas", "isso" — o pedido se apoia no turno anterior. */
export const REFERS_BACK = /\b(deles|delas|desses|dessas|disso|dele|dela|eles|elas|mesmos?)\b/;

export function normalizeQuestion(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Verbo de escrita no começo da frase. Ler nunca é ordem: "lança 500 a
 * receber" casava com o resumo financeiro por causa do "a receber", e o
 * usuário recebia um relatório em vez do lançamento.
 */
export const WRITE_VERB =
  /^(adicione|adiciona|adicionar|lanca|lancar|lance|registra|registre|registrar|cria|crie|criar|cadastra|cadastre|cadastrar|apaga|apague|apagar|exclui|exclua|excluir|move|mova|mover|manda|mande|mandar|envia|envie|enviar|marca|marque|marcar|remarca|remarque|cancela|cancele|cancelar|renomeia|renomeie|arquiva|arquive|publica|publique|anota|anote|anotar|favorita|favorite|bloqueia|bloqueie|ativa|ative|desativa|desative|poe|poem|bota|da acesso|libera)\b/;

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

/**
 * Recorte de tempo dito na frase. `since`/`until` olham para trás (o que já
 * aconteceu); `futureUntil` existe porque "essa semana" significa coisas
 * opostas em criação e em compromisso — um olha o passado, o outro o que vem.
 */
export interface AstroPeriod {
  since: Date;
  until: Date;
  /** Fim da janela quando o que se pergunta está no futuro. */
  futureUntil: Date;
  label: string;
}

const DAY_MS = 24 * 60 * 60_000;

export function periodFrom(text: string): AstroPeriod | null {
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + DAY_MS);

  if (/\bhoje\b/.test(text)) {
    return { since: today, until: tomorrow, futureUntil: tomorrow, label: "hoje" };
  }
  if (/\bamanha\b/.test(text)) {
    const afterTomorrow = new Date(tomorrow.getTime() + DAY_MS);
    return { since: tomorrow, until: afterTomorrow, futureUntil: afterTomorrow, label: "amanhã" };
  }
  if (/\bontem\b/.test(text)) {
    const yesterday = new Date(today.getTime() - DAY_MS);
    return { since: yesterday, until: today, futureUntil: today, label: "ontem" };
  }
  if (/\b(essa|esta|nesta|na|proxima) semana\b|\bultimos 7 dias\b|\b7 dias\b/.test(text)) {
    return {
      since: new Date(today.getTime() - 7 * DAY_MS),
      until: tomorrow,
      futureUntil: new Date(today.getTime() + 7 * DAY_MS),
      label: "nesta semana",
    };
  }
  if (/\b(mes passado|mes anterior|ultimo mes)\b/.test(text)) {
    const now = new Date();
    return {
      since: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      until: startOfMonth(),
      futureUntil: startOfMonth(),
      label: "no mês passado",
    };
  }
  if (/\b(semana passada|semana anterior|ultima semana)\b/.test(text)) {
    return {
      since: new Date(today.getTime() - 14 * DAY_MS),
      until: new Date(today.getTime() - 7 * DAY_MS),
      futureUntil: today,
      label: "na semana passada",
    };
  }
  if (/\b(esse|este|neste|no|deste) mes\b/.test(text)) {
    const start = startOfMonth();
    return {
      since: start,
      until: tomorrow,
      futureUntil: new Date(start.getFullYear(), start.getMonth() + 1, 1),
      label: "neste mês",
    };
  }
  return null;
}

/** Filtro Prisma de um campo de data, ou nada quando não há recorte. */
export function createdWithin(period: AstroPeriod | null) {
  return period ? { createdAt: { gte: period.since, lt: period.until } } : {};
}
