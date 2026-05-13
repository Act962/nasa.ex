/**
 * Extrai metadados de evento de uma página HTML qualquer. Server-side
 * only (usa `fetch` global e regex em string grande). Priorização:
 *
 *   1. JSON-LD com `@type: "Event"` (Sympla, Eventbrite, Meetup, Hub
 *      do Sympla, sites com Schema.org bem montado) — mais confiável.
 *   2. OpenGraph (`og:title`, `og:description`, `og:image`) — fallback
 *      universal.
 *   3. Tags HTML básicas (`<title>`, `<meta name="description">`) —
 *      último recurso.
 *   4. Extração de datas em PT-BR do texto livre (descrição, título) —
 *      quando JSON-LD/OG não trouxe `startDate`. Cobre páginas que
 *      escondem a data na prosa: "15 e 16 de maio de 2026".
 *
 * Sem libs novas — só regex (`cheerio`/`jsdom` não estão no
 * package.json e a regra é não adicionar dep nova).
 */

import { extractDateFromText } from "./extract-date-from-text";

/**
 * Procura por URLs do Google Maps em qualquer lugar do HTML — `<a href>`
 * de "Como chegar", iframes embedados, ou JSON-LD escondido. Quando
 * acha, preferimos sobre texto puro pra `address` porque permite
 * embed do mapa no detalhe do evento + pin preciso.
 *
 * Suporta:
 *  - https://www.google.com/maps/...
 *  - https://maps.google.com/...
 *  - https://goo.gl/maps/...
 *  - https://maps.app.goo.gl/...
 */
function findGoogleMapsUrlInHtml(html: string): string | null {
  // Procura por URLs Maps em hrefs e em src de iframes
  const patterns = [
    /https?:\/\/(?:www\.)?google\.com\/maps\/[^\s"'<>]+/i,
    /https?:\/\/maps\.google\.com\/[^\s"'<>]*/i,
    /https?:\/\/goo\.gl\/maps\/[^\s"'<>]+/i,
    /https?:\/\/maps\.app\.goo\.gl\/[^\s"'<>]+/i,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m?.[0]) {
      // Limpa entidades HTML que aparecem em URLs dentro de HTML
      return m[0]
        .replace(/&amp;/g, "&")
        .replace(/\\u002F/g, "/")
        // Remove trailing punctuation/quotes que entrou no match
        .replace(/["'<>)]+$/, "");
    }
  }
  return null;
}

export type ParsedEvent = {
  title: string | null;
  description: string | null;
  startDate: string | null; // ISO
  endDate: string | null; // ISO
  imageUrl: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  registrationUrl: string | null;
};

const EMPTY: ParsedEvent = {
  title: null,
  description: null,
  startDate: null,
  endDate: null,
  imageUrl: null,
  city: null,
  state: null,
  address: null,
  registrationUrl: null,
};

/**
 * Resolve um URL relativo (`/images/x.jpg`) contra a página base.
 * Se já é absoluto, devolve direto. URLs inválidas viram `null`.
 */
function resolveUrl(href: string | null | undefined, baseUrl: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

/** Decodifica entidades HTML básicas que aparecem em meta tags. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Lê `<meta property="og:X" content="...">` OU `<meta name="X" content="...">`.
 * Aceita atributos em ordem invertida (`content` antes de `property`)
 * porque alguns sites geram HTML não-canônico.
 */
function getMeta(html: string, key: string): string | null {
  // property="og:X" OR name="X" — tenta os dois formatos comuns
  const patterns = [
    new RegExp(
      `<meta[^>]*?(?:property|name)=["']${key}["'][^>]*?content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*?content=["']([^"']*)["'][^>]*?(?:property|name)=["']${key}["']`,
      "i",
    ),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decodeHtmlEntities(m[1]).trim();
  }
  return null;
}

/**
 * Extrai e parsea TODOS os blocos `<script type="application/ld+json">`.
 * Devolve um array — pode haver múltiplos (BreadcrumbList + Event etc).
 */
function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Alguns sites geram JSON-LD inválido (Sympla, às vezes). Ignora.
    }
  }
  return out;
}

const EVENT_TYPES = new Set([
  "Event",
  "BusinessEvent",
  "ChildrensEvent",
  "ComedyEvent",
  "CourseInstance",
  "DanceEvent",
  "DeliveryEvent",
  "EducationEvent",
  "EventSeries",
  "ExhibitionEvent",
  "Festival",
  "FoodEvent",
  "LiteraryEvent",
  "MusicEvent",
  "PublicationEvent",
  "SaleEvent",
  "ScreeningEvent",
  "SocialEvent",
  "SportsEvent",
  "TheaterEvent",
  "VisualArtsEvent",
]);

/**
 * Walks recursivamente o JSON-LD procurando o primeiro objeto com
 * `@type` de evento. Schema.org permite tipos compostos (array de
 * @type), `@graph` aninhado, e wrappers — todos os casos cobertos.
 */
function findEventNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findEventNode(item);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  const types = Array.isArray(t) ? t : t ? [t] : [];
  if (types.some((x) => typeof x === "string" && EVENT_TYPES.has(x))) {
    return obj;
  }
  const graph = obj["@graph"];
  if (graph) {
    const found = findEventNode(graph);
    if (found) return found;
  }
  return null;
}

/**
 * Extrai do nó Event do JSON-LD os campos relevantes. Schema.org
 * tem variantes (image pode ser string, array, ou ImageObject;
 * location pode ser Place com address aninhado, etc).
 */
function parseEventNode(
  event: Record<string, unknown>,
  baseUrl: string,
): ParsedEvent {
  const out: ParsedEvent = { ...EMPTY };

  out.title =
    (typeof event.name === "string" ? event.name : null) ?? null;

  if (typeof event.description === "string") {
    out.description = event.description.trim() || null;
  }

  if (typeof event.startDate === "string") {
    out.startDate = event.startDate;
  }
  if (typeof event.endDate === "string") {
    out.endDate = event.endDate;
  }

  // image: pode ser string, array de strings, ou ImageObject `{ url, ... }`
  const img = event.image;
  if (typeof img === "string") {
    out.imageUrl = resolveUrl(img, baseUrl);
  } else if (Array.isArray(img) && img.length > 0) {
    const first = img[0];
    if (typeof first === "string") {
      out.imageUrl = resolveUrl(first, baseUrl);
    } else if (first && typeof first === "object" && "url" in first) {
      const u = (first as { url?: unknown }).url;
      if (typeof u === "string") out.imageUrl = resolveUrl(u, baseUrl);
    }
  } else if (img && typeof img === "object" && "url" in img) {
    const u = (img as { url?: unknown }).url;
    if (typeof u === "string") out.imageUrl = resolveUrl(u, baseUrl);
  }

  // location: pode ser Place com address (PostalAddress) ou string
  const location = event.location;
  if (location && typeof location === "object") {
    // Pega o primeiro location se for array (eventos online+presencial)
    const loc = Array.isArray(location) ? location[0] : location;
    if (loc && typeof loc === "object") {
      const locObj = loc as Record<string, unknown>;
      const addr = locObj.address;
      if (typeof addr === "string") {
        out.address = addr;
      } else if (addr && typeof addr === "object") {
        const addrObj = addr as Record<string, unknown>;
        if (typeof addrObj.streetAddress === "string") {
          out.address = addrObj.streetAddress;
        }
        if (typeof addrObj.addressLocality === "string") {
          out.city = addrObj.addressLocality;
        }
        if (typeof addrObj.addressRegion === "string") {
          out.state = addrObj.addressRegion;
        }
      }
      // url do local pode virar registrationUrl em alguns esquemas
      if (typeof locObj.url === "string" && !out.registrationUrl) {
        out.registrationUrl = locObj.url;
      }
    }
  }

  // offers.url → registrationUrl (Sympla, Eventbrite usam Offer com URL
  // do ingresso/inscrição)
  const offers = event.offers;
  if (offers && typeof offers === "object") {
    const off = Array.isArray(offers) ? offers[0] : offers;
    if (off && typeof off === "object") {
      const u = (off as { url?: unknown }).url;
      if (typeof u === "string") out.registrationUrl = u;
    }
  }

  return out;
}

/**
 * Fallback OG/HTML quando JSON-LD não está disponível ou não tem
 * Event. Bem mais limitado — sem datas estruturadas, sem location.
 */
function parseFromMetaTags(html: string, baseUrl: string): ParsedEvent {
  const out: ParsedEvent = { ...EMPTY };

  out.title =
    getMeta(html, "og:title") ??
    getMeta(html, "twitter:title") ??
    (() => {
      const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return m ? decodeHtmlEntities(m[1].trim()) : null;
    })();

  out.description =
    getMeta(html, "og:description") ??
    getMeta(html, "twitter:description") ??
    getMeta(html, "description");

  const ogImage = getMeta(html, "og:image") ?? getMeta(html, "twitter:image");
  out.imageUrl = resolveUrl(ogImage, baseUrl);

  return out;
}

/**
 * Mescla dois ParsedEvent: o `primary` ganha campos definidos, mas
 * campos `null` do primary são suplementados pelo `fallback`. Útil
 * pra combinar JSON-LD (mais rico) + OG (mais universal).
 */
function merge(primary: ParsedEvent, fallback: ParsedEvent): ParsedEvent {
  return {
    title: primary.title ?? fallback.title,
    description: primary.description ?? fallback.description,
    startDate: primary.startDate ?? fallback.startDate,
    endDate: primary.endDate ?? fallback.endDate,
    imageUrl: primary.imageUrl ?? fallback.imageUrl,
    city: primary.city ?? fallback.city,
    state: primary.state ?? fallback.state,
    address: primary.address ?? fallback.address,
    registrationUrl: primary.registrationUrl ?? fallback.registrationUrl,
  };
}

/**
 * Erros conhecidos de parser pra dar mensagens úteis na UI.
 */
export class ParseEventError extends Error {
  constructor(
    message: string,
    public code: "BOT_PROTECTION" | "NETWORK" | "NO_DATA",
  ) {
    super(message);
  }
}

/**
 * Detecta se o HTML/URL final é uma página de proteção anti-bot
 * (Queue-It do Sympla, Cloudflare challenge, Akamai, etc). Essas
 * páginas vêm com 200 mas conteúdo é só um redirect JS / challenge.
 */
function isBotProtectionPage(html: string, finalUrl: string): boolean {
  const lower = html.toLowerCase().slice(0, 5000);
  if (finalUrl.includes("queueittoken") || finalUrl.includes("queue-it.net")) {
    return true;
  }
  if (
    lower.includes("queue-it") ||
    lower.includes("challenge-platform") ||
    lower.includes("cf-chl-bypass") ||
    lower.includes("just a moment") ||
    lower.includes("attention required") ||
    lower.includes("akamai") &&
    lower.includes("access denied")
  ) {
    return true;
  }
  return false;
}

/**
 * Função principal: faz fetch da URL, parsea, devolve metadados.
 * Aceita falhas silenciosas — campos viram `null` se não encontrar.
 * Quando detecta proteção anti-bot, lança `ParseEventError` pra UI
 * dar mensagem específica.
 */
export async function parseEventFromUrl(rawUrl: string): Promise<ParsedEvent> {
  const url = rawUrl.trim();
  if (!url) return EMPTY;

  try {
    // User-Agent de browser pra sites que bloqueiam bots (Sympla,
    // Eventbrite). Timeout via AbortController evita ficar pendurado
    // em URLs ruins.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return EMPTY;
    const html = await res.text();
    const finalUrl = res.url || url;

    // Detecta páginas de proteção anti-bot (queue-it, cloudflare,
    // akamai). Sem renderizar JS, não conseguimos passar — manda
    // erro específico pra UI explicar e sugerir alternativa.
    if (isBotProtectionPage(html, finalUrl)) {
      throw new ParseEventError(
        "Essa página está protegida contra bots (fila ou anti-scraping). Tente colar o flyer do evento como IMAGEM — a IA consegue ler.",
        "BOT_PROTECTION",
      );
    }

    // 1. Tenta JSON-LD Event
    const jsonLdNodes = extractJsonLd(html);
    let fromJsonLd: ParsedEvent = EMPTY;
    for (const node of jsonLdNodes) {
      const event = findEventNode(node);
      if (event) {
        fromJsonLd = parseEventNode(event, finalUrl);
        break;
      }
    }

    // 2. OG/HTML fallback (sempre, pra suplementar campos vazios)
    const fromOg = parseFromMetaTags(html, finalUrl);

    const merged = merge(fromJsonLd, fromOg);

    // 3. Se ainda não tem data, tenta extrair do texto livre (descrição
    //    + título). Cobre páginas tipo "Semana S - 15 e 16 de maio de
    //    2026" que escondem a data na prosa do og:description.
    if (!merged.startDate) {
      const textSources = [
        merged.description,
        merged.title,
        getMeta(html, "description"),
      ].filter((s): s is string => !!s);
      for (const text of textSources) {
        const dates = extractDateFromText(text);
        if (dates) {
          merged.startDate = dates.startDate;
          if (!merged.endDate) merged.endDate = dates.endDate;
          break;
        }
      }
    }

    // 4. Google Maps URL na página → vira `address` (prevalece sobre
    //    texto puro). Permite renderizar mapa embedado + pin preciso
    //    no detalhe do evento, em vez de só busca textual.
    const mapsUrl = findGoogleMapsUrlInHtml(html);
    if (mapsUrl) {
      merged.address = mapsUrl;
    }

    return merged;
  } catch (err) {
    // Re-lança ParseEventError pra UI dar mensagem útil (proteção
    // anti-bot, etc). Outras falhas (timeout, DNS, malformed HTML)
    // viram EMPTY silenciosamente — caller decide se é "sem dados".
    if (err instanceof ParseEventError) throw err;
    return EMPTY;
  }
}
