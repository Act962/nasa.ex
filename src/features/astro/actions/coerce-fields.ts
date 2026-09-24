import "server-only";
import { z } from "zod";
import type { AstroAction } from "./types";

// O classificador devolve todo campo como string — é o que o structured
// output permite sem `propertyNames`. Mas os schemas das ações têm boolean e
// number, e `z.boolean()` recusa "true".
//
// Sem esta conversão, TODO verbo com campo booleano ficava quebrado: o parse
// falhava, o campo entrava na lista de "faltando" e o Astro perguntava
// "me diga: published" em vez de publicar.

/**
 * Pronome não é nome de ninguém. Duas tentativas de resolver isso no prompt
 * falharam — o modelo às vezes devolve "ele" como `clientName`. Descartar aqui
 * é determinístico e faz o Astro perguntar, em vez de buscar um lead chamado
 * "ele" e dizer que não existe.
 */
const PRONOUNS = new Set([
  "ele", "ela", "eles", "elas", "isso", "isto", "aquele", "aquela",
  "o mesmo", "a mesma", "esse", "essa", "este", "esta", "dele", "dela",
]);

/**
 * Marcas de referência ao que já foi dito. Só na presença de uma delas um
 * nome pode vir da conversa anterior em vez da frase atual.
 */
const ANAPHORA = [
  "ele", "ela", "eles", "elas", "dele", "dela", "esse", "essa", "este", "esta",
  "isso", "isto", "aquele", "aquela", "o mesmo", "a mesma", "mesmo cliente",
  "a última", "o último", "a ultima", "o ultimo", "anterior", "de novo",
];

/**
 * Nome é sempre citação: ninguém calcula o nome de um cliente, ele aparece na
 * frase. Data, frequência e booleano, não — esses o modelo deriva ("toda
 * segunda" vira WEEKLY), e por isso a regra vale só para campos de nome.
 */
function isNameField(key: string): boolean {
  return /name$/i.test(key);
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Todo pedaço significativo do valor precisa estar no texto. */
function appearsIn(value: string, text: string): boolean {
  const haystack = normalize(text);
  const tokens = normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
  if (tokens.length === 0) return normalize(value).length > 0 && haystack.includes(normalize(value));
  return tokens.every((token) => haystack.includes(token));
}

/**
 * "Crie um novo tracking" virou um tracking chamado "Novo tracking": o
 * substantivo da coisa estava na frase, então passou pela regra de citação.
 * Nome genérico não é nome — é a ausência dele.
 */
/**
 * O substantivo da categoria, por campo. Genérico é relativo: "Proposta" é
 * nome legítimo de coluna, e a lista única derrubava esse caso junto com
 * "Novo tracking". Só vale para campo que nomeia algo NOVO — em campo que
 * procura algo existente, "briefing" é busca válida.
 */
const CATEGORY_NOUNS: Record<string, string[]> = {
  trackingName: ["tracking", "trackings", "funil", "funis", "board"],
  leadName: ["lead", "leads", "cliente", "clientes", "contato", "contatos"],
  statusName: ["coluna", "colunas", "etapa", "etapas", "status"],
  workspaceName: ["workspace", "workspaces", "quadro", "quadros"],
  agendaName: ["agenda", "agendas"],
  tagName: ["tag", "tags", "etiqueta", "etiquetas"],
};

const NAME_STOPWORDS = new Set([
  "novo", "nova", "novos", "novas", "um", "uma", "o", "a", "os", "as",
  "meu", "minha", "esse", "essa", "este", "esta", "de", "do", "da",
]);

/** Sobrou algum substantivo próprio, ou só o nome da categoria? */
function isCategoryOnly(field: string, value: string): boolean {
  const nouns = CATEGORY_NOUNS[field];
  if (!nouns) return false;
  const words = normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0 && !NAME_STOPWORDS.has(word));
  if (words.length === 0) return true;
  return words.every((word) => nouns.includes(word));
}

const TRUTHY = new Set(["true", "sim", "yes", "1", "ativar", "publicar"]);
const FALSY = new Set(["false", "nao", "não", "no", "0", "desativar", "despublicar"]);

/** Desembrulha optional/nullable/default para chegar ao tipo de verdade. */
function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault
  ) {
    current = current._def.innerType as z.ZodTypeAny;
  }
  return current;
}

function coerceValue(schema: z.ZodTypeAny, raw: string): unknown {
  const target = unwrap(schema);

  if (target instanceof z.ZodBoolean) {
    const normalized = raw.trim().toLowerCase();
    if (TRUTHY.has(normalized)) return true;
    if (FALSY.has(normalized)) return false;
    return raw;
  }

  if (target instanceof z.ZodNumber) {
    const parsed = Number(raw.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : raw;
  }

  return raw;
}

/**
 * "Quero criar um novo lead" criou um lead chamado "Weydson Lima" — nome que
 * só existia na conversa anterior. O modelo preenche o campo obrigatório com
 * o que tem à mão em vez de deixá-lo vazio, e o Astro executa sem perguntar.
 *
 * Nome ausente da frase atual só vale se a frase apontar para trás ("manda
 * pra ele"). Sem isso, o campo cai e o Astro pergunta — que é o que alguém
 * faria.
 */
function isInvented(
  key: string,
  value: string,
  context?: { userText?: string; history?: string[]; newNameFields?: string[] },
): boolean {
  const userText = context?.userText;
  if (!userText || !isNameField(key)) return false;
  // Campo que nomeia algo novo não aceita o nome da própria categoria.
  if ((context?.newNameFields ?? []).includes(key) && isCategoryOnly(key, value)) {
    return true;
  }
  if (appearsIn(value, userText)) return false;

  const refersBack = ANAPHORA.some((marker) => normalize(userText).includes(marker));
  if (!refersBack) return true;

  const history = (context.history ?? []).join(" ");
  return !appearsIn(value, history);
}

/**
 * Converte os pares do classificador para os tipos que o schema da ação
 * espera. Valor que não converte passa intacto — o `safeParse` seguinte é
 * quem decide se serve.
 */
export function coerceFields(
  action: AstroAction,
  fields: Record<string, string>,
  context?: { userText?: string; history?: string[]; newNameFields?: string[] },
): Record<string, unknown> {
  const shape =
    action.input instanceof z.ZodObject
      ? (action.input.shape as Record<string, z.ZodTypeAny>)
      : {};

  const coerced: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    // O modelo preenche campo opcional com "" em vez de omitir, e "" falha em
    // `min(2)` e em `datetime()`. Ausente é o que ele quis dizer.
    if (value.trim() === "") continue;
    if (PRONOUNS.has(value.trim().toLowerCase())) continue;
    if (isInvented(key, value, context)) continue;
    const fieldSchema = shape[key];
    coerced[key] = fieldSchema ? coerceValue(fieldSchema, value) : value;
  }
  return coerced;
}

/**
 * Monta a entrada final da ação: o que o verbo implica (por código) mais o que
 * o classificador extraiu (que vence em caso de conflito, por ser explícito).
 *
 * Runtime e teste chamam esta função — não a `coerceFields` direta. Quando o
 * teste montava a entrada por conta própria, ele passou a verificar um caminho
 * que a aplicação não usava mais.
 */
export function buildActionInput(
  action: AstroAction,
  fields: Record<string, string>,
  userText: string,
  history?: string[],
): Record<string, unknown> {
  return {
    ...(action.inferFields?.(userText) ?? {}),
    ...coerceFields(action, fields, {
      userText,
      history,
      newNameFields: action.newNameFields,
    }),
  };
}
