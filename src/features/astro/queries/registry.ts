import "server-only";
import { ASTRO_READ_DENIAL } from "@/features/astro/lib/permission-denial";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  COMPOSE_VERB_ANYWHERE,
  WRITE_VERB,
  normalizeQuestion,
  type AstroQuery,
  type AstroQueryResult,
} from "./types";
import { TRACKING_QUERIES } from "./tracking";
import { LEAD_INTEREST_QUERIES } from "./lead-interest";
import { AGENDA_QUERIES } from "./agenda";
import { APP_QUERIES } from "./apps";
import { FORGE_QUERIES } from "./forge";
import { INSIGHTS_QUERIES } from "./insights";
import { canAstroRead } from "@/features/astro/actions/permission-gate";
import { assertPaymentToolAccess } from "@/features/astro/server/tools/finance/access";
import { INTELLIGENCE_QUERIES } from "./intelligence";
import { ANALYSIS_QUERIES } from "./analysis";
import { PLATFORM_QUERIES } from "./platform";
import { RESPONSE_QUERIES } from "./responses";
import { LEAD_LOOKUP_QUERIES } from "./lead-lookup";
import { RECORD_QUERIES } from "./records";
import { matchesAnyIntentPattern } from "@/features/astro/actions/match-intent-pattern";
import { isAccountingQuestion } from "./accounting-question";

export type { AstroQuery, AstroQueryResult } from "./types";

/**
 * Ordem importa: a primeira que casa responde. As mais específicas vêm
 * antes das genéricas — "leads sem responsável" precisa ser testada antes
 * de "quantos leads".
 */
export const ASTRO_QUERIES: AstroQuery[] = [
  // Análises com filtro e período antes de tudo: são as perguntas mais
  // específicas e devolvem `null` quando o filtro não existe na org.
  ...LEAD_LOOKUP_QUERIES,
  // Fichas antes de tudo que fala de clientes, vencimentos e listas: a consulta devolve `null`
  // quando a empresa não usa fichas ou a frase não é sobre elas (spec 0081, RNF-3).
  ...RECORD_QUERIES,
  ...RESPONSE_QUERIES,
  // Antes das análises: "leads com interesse alto" casaria com o filtro de leads "quentes" (spec 0085).
  ...LEAD_INTEREST_QUERIES,
  ...ANALYSIS_QUERIES,
  // Insights antes do tracking: "quantos leads com a tag X" é relatório, e
  // a contagem genérica de leads casaria primeiro.
  ...INSIGHTS_QUERIES,
  ...TRACKING_QUERIES,
  // Antes das genéricas de app: "propostas do Kauê" é lista de um cliente, e
  // a contagem por situação casaria primeiro (spec 0032, RF-3).
  ...FORGE_QUERIES,
  ...AGENDA_QUERIES,
  ...APP_QUERIES,
  ...PLATFORM_QUERIES,
  // Regra e conhecimento por último: só respondem o que nenhum app respondeu.
  ...INTELLIGENCE_QUERIES,
];

export async function runAstroQuery(params: {
  ctx: AgentContext;
  text: string;
  /** Turnos anteriores — "me manda a lista deles" só existe com eles. */
  history?: string[];
}): Promise<{ key: string; result: AstroQueryResult } | null> {
  const text = normalizeQuestion(params.text);
  // Ordem não é consulta. Sem isto, "lança 500 a receber" casava com o resumo
  // financeiro e devolvia relatório em vez de lançar.
  if (WRITE_VERB.test(text) || COMPOSE_VERB_ANYWHERE.test(text)) return null;
  // Frase que casa com o padrão de uma ação é ordem, não pergunta:
  // "paguei 50 reais de estacionamento" casava com "quanto foi pago no mês"
  // e devolvia relatório em vez de lançar (spec 0033, RF-9).
  if (matchesAnyIntentPattern(params.text)) return null;
  // Imposto, guia, certidão, balanço: quem responde são as tools contábeis do
  // orquestrador — as consultas do financeiro dariam número de outra coisa.
  if (isAccountingQuestion(params.text, params.ctx.route)) return null;
  const history = normalizeQuestion((params.history ?? []).slice(-4).join(" "));

  // Duas perguntas numa frase (F5-CRS-01): cada uma responde, as duas juntas.
  const [firstQuestion, secondQuestion] = text.split(SECOND_QUESTION);
  if (secondQuestion) {
    const first = await runSingleQuery(params.ctx, firstQuestion, history);
    const second = first
      ? await runSingleQuery(params.ctx, completeSecondQuestion(firstQuestion, secondQuestion), history)
      : null;
    if (first && second) {
      return {
        key: `${first.key}+${second.key}`,
        result: { text: `${first.result.text}\n${second.result.text}`, table: first.result.table ?? second.result.table },
      };
    }
  }
  return runSingleQuery(params.ctx, text, history);
}

const SECOND_QUESTION = /\s+e\s+(?=(?:quantos|quantas|quais|qual|quem)\b)/;
const SUBJECT = /\b(leads?|clientes?|propostas?|conversas?|mensagens?|tarefas?|lancamentos?|compromissos?)\b/;
const PERIOD = /\b(hoje|ontem|amanha|(?:essa|esta|nesta) semana|(?:este|esse|neste) mes|mes passado)\b/;

/** "quantos foram respondidos" herda da primeira o assunto e o período. */
function completeSecondQuestion(first: string, second: string): string {
  const subject = SUBJECT.test(second) ? "" : first.match(SUBJECT)?.[0] ?? "";
  const period = PERIOD.test(second) ? "" : first.match(PERIOD)?.[0] ?? "";
  return [second, subject, period].filter(Boolean).join(" ");
}

async function runSingleQuery(
  ctx: AgentContext,
  text: string,
  history: string,
): Promise<{ key: string; result: AstroQueryResult } | null> {
  for (const query of ASTRO_QUERIES) {
    if (!query.matches(text, history)) continue;
    // Casou a frase, mas quem pergunta não pode ver: a recusa sai em código.
    // Seguir para o orquestrador custava ~23 mil tokens para dizer o mesmo.
    if (!(await canAstroRead(ctx, query.appKey))) {
      return { key: "permission.denied", result: { text: ASTRO_READ_DENIAL } };
    }
    // O Financeiro tem acesso próprio, além da matriz: sem ele, a tela
    // recusa — e o ASTRO recusa igual (F2-12).
    if (query.app === "payment") {
      const financeAccess = await assertPaymentToolAccess(ctx, "entries", "view");
      if (!financeAccess.ok) return { key: "permission.denied", result: { text: financeAccess.error } };
    }
    const result = await query.run({ ctx: ctx, text, history });
    if (result) return { key: query.key, result };
  }
  return null;
}
