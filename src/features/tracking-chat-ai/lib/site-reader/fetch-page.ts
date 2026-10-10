import "server-only";
import { request } from "node:https";
import type { LookupFunction } from "node:net";
import { UnsafeSiteAddressError, parsePublicSiteUrl, resolvePublicAddress, siteKey, type ResolvedAddress } from "./safe-address";

const PAGE_TIMEOUT_MS = 10_000;
const MAX_PAGE_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

interface RawResponse {
  statusCode: number;
  location: string | null;
  contentType: string;
  body: string;
}

/**
 * A conexão usa exatamente o IP já conferido. Sem isso, o nome poderia resolver
 * para um endereço público na checagem e para um interno na hora de conectar.
 */
function pinnedLookup(resolved: ResolvedAddress): LookupFunction {
  return ((_hostname: string, options: unknown, callback: unknown) => {
    const done = (typeof options === "function" ? options : callback) as (
      error: Error | null,
      address: string | { address: string; family: number }[],
      family?: number,
    ) => void;
    const wantsAll = typeof options === "object" && options !== null && (options as { all?: boolean }).all === true;
    if (wantsAll) done(null, [{ address: resolved.address, family: resolved.family }]);
    else done(null, resolved.address, resolved.family);
  }) as LookupFunction;
}

function requestOnce(url: URL, resolved: ResolvedAddress): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        protocol: "https:",
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        lookup: pinnedLookup(resolved),
        timeout: PAGE_TIMEOUT_MS,
        // Nada que identifique a empresa, o usuário ou a plataforma sai neste pedido.
        headers: { accept: "text/html", "accept-encoding": "identity", "accept-language": "pt-BR,pt;q=0.9", "user-agent": "Mozilla/5.0 (compatible; SiteReader/1.0)" },
      },
      (incoming) => {
        const statusCode = incoming.statusCode ?? 0;
        const contentType = String(incoming.headers["content-type"] ?? "").toLowerCase();
        const location = typeof incoming.headers.location === "string" ? incoming.headers.location : null;
        if (statusCode >= 300 && statusCode < 400) {
          incoming.resume();
          resolve({ statusCode, location, contentType, body: "" });
          return;
        }
        if (statusCode !== 200 || !contentType.includes("text/html")) {
          incoming.destroy();
          reject(new Error(`unreadable_page:${statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        let receivedBytes = 0;
        incoming.on("data", (chunk: Buffer) => {
          receivedBytes += chunk.length;
          if (receivedBytes > MAX_PAGE_BYTES) {
            // Página grande demais: fica com o que já chegou.
            incoming.destroy();
            resolve({ statusCode, location, contentType, body: Buffer.concat(chunks).toString("utf8") });
            return;
          }
          chunks.push(chunk);
        });
        incoming.on("end", () => resolve({ statusCode, location, contentType, body: Buffer.concat(chunks).toString("utf8") }));
        incoming.on("error", reject);
      },
    );
    outgoing.on("timeout", () => outgoing.destroy(new Error("page_timeout")));
    outgoing.on("error", reject);
    outgoing.end();
  });
}

/** Busca uma página pública. Redirecionamento só para o mesmo site, e cada salto é conferido de novo. */
export async function fetchPublicPage(rawUrl: string): Promise<{ url: string; html: string }> {
  let url = parsePublicSiteUrl(rawUrl);
  const originSite = siteKey(url.hostname);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const resolved = await resolvePublicAddress(url.hostname);
    const response = await requestOnce(url, resolved);
    if (response.statusCode >= 300 && response.statusCode < 400) {
      if (!response.location) throw new Error("redirect_without_location");
      const nextUrl = parsePublicSiteUrl(new URL(response.location, url).toString());
      if (siteKey(nextUrl.hostname) !== originSite) throw new UnsafeSiteAddressError("redirect_to_other_site");
      url = nextUrl;
      continue;
    }
    return { url: url.toString(), html: response.body };
  }
  throw new Error("too_many_redirects");
}
