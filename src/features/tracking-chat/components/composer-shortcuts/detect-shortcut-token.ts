export const SHORTCUT_APPS = [
  { key: "recibo", label: "Recibo", hint: "Abrir o recibo deste cliente" },
  { key: "formulario", label: "Formulário", hint: "Inserir o link de um formulário" },
  { key: "proposta", label: "Proposta", hint: "Inserir o link de uma proposta" },
] as const;

export type ShortcutAppKey = (typeof SHORTCUT_APPS)[number]["key"];

const SCRIPT_PREFIX = "script/";

export type ShortcutToken =
  | { kind: "pick-app"; start: number; end: number; query: string; highlightEnd: number }
  | { kind: "app-item"; app: ShortcutAppKey; start: number; end: number; query: string; highlightEnd: number }
  | { kind: "script"; start: number; end: number; query: string; highlightEnd: number };

const isShortcutApp = (value: string): value is ShortcutAppKey => SHORTCUT_APPS.some((app) => app.key === value);

/**
 * Atalho sendo digitado no cursor: "@app/busca" ou "/busca" ("/script/busca" também vale), começando no
 * início de uma palavra. `highlightEnd` marca o fim da primeira palavra antes da "/", que fica azul.
 */
export function detectShortcutToken(text: string, caret: number): ShortcutToken | null {
  let start = caret;
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  const token = text.slice(start, caret);
  if (token.length === 0) return null;
  const end = caret;

  if (token.startsWith("@")) {
    const body = token.slice(1);
    const slashIndex = body.indexOf("/");
    if (slashIndex === -1) return { kind: "pick-app", start, end, query: body, highlightEnd: end };
    const app = body.slice(0, slashIndex).toLowerCase();
    if (!isShortcutApp(app)) return null;
    return { kind: "app-item", app, start, end, query: body.slice(slashIndex + 1), highlightEnd: start + 1 + slashIndex };
  }

  if (token.startsWith("/")) {
    const body = token.slice(1);
    if (body.toLowerCase().startsWith(SCRIPT_PREFIX)) {
      return { kind: "script", start, end, query: body.slice(SCRIPT_PREFIX.length), highlightEnd: start + SCRIPT_PREFIX.length };
    }
    return { kind: "script", start, end, query: body, highlightEnd: end };
  }

  return null;
}

/** Busca sem diferença de acento e de maiúsculas; "-" e "_" valem como espaço ("boas-vindas"). */
export function normalizeShortcutQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
