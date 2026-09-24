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
 * Converte os pares do classificador para os tipos que o schema da ação
 * espera. Valor que não converte passa intacto — o `safeParse` seguinte é
 * quem decide se serve.
 */
export function coerceFields(
  action: AstroAction,
  fields: Record<string, string>,
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
): Record<string, unknown> {
  return {
    ...(action.inferFields?.(userText) ?? {}),
    ...coerceFields(action, fields),
  };
}
