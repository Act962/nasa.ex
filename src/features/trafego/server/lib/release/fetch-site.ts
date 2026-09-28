import "server-only";

/**
 * Lê o texto visível de uma página para alimentar o Release.
 *
 * Sem lib de parsing: precisamos de texto corrido, não de DOM. E é conteúdo
 * que o usuário aponta, então o fetch tem timeout, limite de tamanho e recusa
 * endereço interno — sem isso o campo vira um SSRF com URL amigável.
 */
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;
const MAX_CHARS = 12_000;
const MAX_REDIRECTS = 4;

export interface SiteExtract {
  url: string;
  title: string | null;
  text: string;
  chars: number;
}

/** Tem esquema explícito? "file:", "javascript:" e afins caem aqui. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeSiteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  // Só completa quando o cliente digitou "padaria.com.br". Prefixar um
  // endereço que já tem esquema transformaria "file:///etc/passwd" num host
  // chamado "file" — erro silencioso em vez de recusa.
  return HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Recusa localhost, IP privado e esquema que não seja http(s). */
export function isPubliclyFetchable(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(normalizeSiteUrl(rawUrl));
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return false;
  }
  // IPv4 privado / loopback / link-local, e IPv6 loopback.
  if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  // IPv6: loopback, unique-local (fc00::/7) e link-local (fe80::/10). O
  // hostname vem entre colchetes no parser da URL.
  const bare = host.startsWith("[") ? host.slice(1, -1) : host;
  if (bare === "::1" || bare === "::") return false;
  if (/^f[cd][0-9a-f]{2}:/.test(bare)) return false;
  if (/^fe[89ab][0-9a-f]:/.test(bare)) return false;
  return true;
}

function stripHtml(html: string): { title: string | null; text: string } {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;

  const text = html
    // Fora tudo que não é conteúdo lido por gente.
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|section|li|h[1-6]|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text };
}

export async function fetchSiteText(rawUrl: string): Promise<SiteExtract | null> {
  if (!isPubliclyFetchable(rawUrl)) return null;
  const url = normalizeSiteUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Seguimos os redirects na mão para revalidar cada destino: com
    // `redirect: "follow"`, um endereço público que redireciona para
    // 169.254.169.254 (metadados da nuvem) passaria pela checagem inicial.
    let current = url;
    let response: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "user-agent": "OrbitaTrafegoBot/1.0 (+https://orbitahub.com.br)" },
      });
      if (response.status < 300 || response.status >= 400) break;

      const location = response.headers.get("location");
      if (!location) return null;
      const next = new URL(location, current).toString();
      if (!isPubliclyFetchable(next)) {
        console.warn(`[trafego/release] redirect recusado: ${current} → ${next}`);
        return null;
      }
      current = next;
      response = null;
    }
    if (!response || !response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) return null;

    const html = new TextDecoder("utf-8").decode(buffer);
    const { title, text } = stripHtml(html);
    if (text.length < 80) return null;

    const trimmed = text.slice(0, MAX_CHARS);
    return { url: current, title, text: trimmed, chars: trimmed.length };
  } catch (error) {
    console.warn(`[trafego/release] leitura do site falhou (${url}):`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
