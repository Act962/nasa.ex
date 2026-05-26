/**
 * Extrai metadados de origem de um elemento DOM via React Fiber.
 *
 * Funciona em dev porque o Next.js (via Babel/SWC com
 * `@babel/plugin-transform-react-jsx-source` habilitado por padrão em
 * `NODE_ENV=development`) injeta `_debugSource = { fileName, lineNumber,
 * columnNumber }` em cada fiber. A propriedade não vai pra produção.
 *
 * Devolve null quando:
 *  - Elemento não tem fiber (não é renderizado pelo React, ou React
 *    nunca tocou nele)
 *  - JSX dev source desabilitado (raro)
 *
 * NÃO use em produção — depende de propriedades internas instáveis
 * (`__reactFiber$<hash>`, `_debugSource`, `.return`). Em produção essas
 * propriedades não existem ou foram minificadas.
 */

export interface ElementSource {
  /** Tag HTML lowercase do elemento (ex: "div", "span"). */
  tagName: string;
  /** Nome do componente React mais próximo (sobe pela fiber tree). */
  componentName: string | null;
  /** Cadeia completa de componentes user-code (do mais próximo ao root). */
  ownerChain: string[];
  /** Primeiros ~60 chars de text content do elemento (truncado). */
  textPreview: string | null;
  /** className COMPLETO (não truncado) — útil pra grep. */
  className: string | null;
  /** Atributos identificadores (id, data-testid, aria-label, title, role). */
  attributes: Array<{ name: string; value: string }>;
}

/**
 * Acha a React Fiber associada ao elemento DOM.
 * React 18+ usa key `__reactFiber$<hash>` (hash varia por instância do
 * React — diferente em StrictMode dev vs prod, então iteramos as keys).
 */
function findFiber(el: HTMLElement): any | null {
  for (const key of Object.keys(el)) {
    if (key.startsWith("__reactFiber$")) {
      return (el as any)[key];
    }
  }
  return null;
}

/**
 * **React 19 removeu `_debugSource` e `_debugStack` dos fibers** (por
 * performance). Não há mais como obter a linha do JSX original em
 * runtime a partir do fiber. As funções abaixo (`getFiberSource`,
 * `parseFirstFrame`, etc) foram removidas porque sempre retornavam
 * null em React 19. Em vez disso, usamos identificadores DOM
 * (`textContent`, `className`, attrs) + cadeia de componentes pra
 * permitir grep do elemento via texto/classes.
 *
 * Esse comportamento é equivalente ao que a React DevTools v6 (oficial)
 * faz pra React 19: não mostra linha do JSX, só nome do componente.
 */

/**
 * Componentes wrapper bem conhecidos (libs / Radix / Next) que não
 * representam "o componente do user". Quando encontramos um deles na
 * fiber tree, pulamos pro próximo nível acima.
 */
const WRAPPER_NAMES = new Set([
  // Next.js
  "Link",
  "LinkComponent",
  "NextLink",
  "Image",
  "NextImage",
  "ImageComponent",
  // Radix UI
  "Slot",
  "Slottable",
  "Primitive",
  "Anchor",
  // React internos / contexts
  "Provider",
  "Consumer",
  "ForwardRef",
  "Memo",
  "Fragment",
  "Suspense",
  "InnerLayoutRouter",
  "OuterLayoutRouter",
  "RenderFromTemplateContext",
  // Outros wrappers comuns
  "QueryClientProvider",
  "Hydrate",
  "HydrationBoundary",
]);

/**
 * Extrai o nome legível de um fiber.type — função normal, classe,
 * forwardRef ou memo. Retorna null se não conseguir.
 */
function getFiberName(rawType: any): string | null {
  if (!rawType) return null;
  if (typeof rawType === "function") {
    return rawType.displayName ?? rawType.name ?? null;
  }
  if (typeof rawType === "object") {
    const inner = rawType.render ?? rawType.type;
    return (
      rawType.displayName ?? inner?.displayName ?? inner?.name ?? null
    );
  }
  return null;
}

/** True se o fiber é um componente (não host element como "div"). */
function isComponentFiber(fiber: any): boolean {
  if (!fiber || !fiber.type) return false;
  if (typeof fiber.type === "function") return true;
  if (typeof fiber.type === "object") {
    const inner = fiber.type.render ?? fiber.type.type;
    return typeof inner === "function";
  }
  return false;
}

/** Atributos que ajudam a identificar elemento — em ordem de prioridade. */
const ID_ATTRIBUTES = [
  "id",
  "data-testid",
  "data-test",
  "aria-label",
  "aria-labelledby",
  "title",
  "role",
  "name",
  "href",
];

/**
 * Extrai identificadores legíveis de um elemento DOM.
 *
 * **React 19 removeu `_debugSource`/`_debugStack` dos fibers** — não tem
 * como saber a linha exata do JSX onde o elemento foi escrito em runtime.
 * Então, em vez de file:line, retornamos identificadores que permitem
 * encontrar o elemento via grep:
 *  - Cadeia de componentes (`LeadFormCard ← LeadFormsDialog ← Page`)
 *  - Texto visível (primeiros 60 chars)
 *  - className completa
 *  - Atributos chave (id, data-testid, aria-label, title, href, role, name)
 *
 * Com `LeadFormCard` + texto "Abrir App" + className, dá pra grep o
 * código e achar o elemento exato em segundos.
 */
export function getElementSource(el: HTMLElement): ElementSource | null {
  try {
    const fiber = findFiber(el);

    // 1. Componente mais próximo (skip wrappers).
    let comp: any = fiber;
    let componentName: string | null = null;
    while (comp) {
      if (isComponentFiber(comp)) {
        const name = getFiberName(comp.type);
        if (name && !WRAPPER_NAMES.has(name)) {
          componentName = name;
          break;
        }
      }
      comp = comp.return;
    }
    if (componentName === "") componentName = "(Anonymous)";

    // 2. Owner chain — todos os componentes user-code do fiber pra cima.
    //    Pula wrappers e duplicatas consecutivas (memo/forwardRef criam
    //    múltiplos fibers com mesmo nome). Limita a 6 níveis pra label
    //    não ficar gigante.
    const ownerChain: string[] = [];
    let cursor: any = comp?.return ?? null;
    let lastAdded: string | null = componentName;
    while (cursor && ownerChain.length < 6) {
      if (isComponentFiber(cursor)) {
        const name = getFiberName(cursor.type);
        if (name && !WRAPPER_NAMES.has(name) && name !== lastAdded) {
          ownerChain.push(name);
          lastAdded = name;
        }
      }
      cursor = cursor.return;
    }

    // 3. Texto visível (primeiros 60 chars, sem múltiplos espaços).
    const rawText = (el.textContent ?? "").trim().replace(/\s+/g, " ");
    const textPreview =
      rawText.length > 60 ? rawText.slice(0, 60) + "…" : rawText || null;

    // 4. ClassName cheia (não truncada).
    const className =
      el instanceof HTMLElement && el.className && typeof el.className === "string"
        ? el.className.trim() || null
        : null;

    // 5. Atributos chave.
    const attributes: Array<{ name: string; value: string }> = [];
    for (const attr of ID_ATTRIBUTES) {
      const v = el.getAttribute(attr);
      if (v) attributes.push({ name: attr, value: v });
    }

    return {
      tagName: el.tagName.toLowerCase(),
      componentName,
      ownerChain,
      textPreview,
      className,
      attributes,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[DevInspector] getElementSource failed:", err);
    return null;
  }
}
