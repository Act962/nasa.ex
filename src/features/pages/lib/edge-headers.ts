/**
 * Contrato entre a portaria de domínios próprios (repositório orbita-pages-edge) e o app.
 * Sem dependências: é importado pelo `proxy.ts`, que roda antes de toda requisição.
 */

/** Segredo compartilhado: só a portaria conhece; sem ele a rota dos sites responde 404. */
export const PAGES_EDGE_SECRET_HEADER = "x-pages-edge-secret";
/** Domínio que o visitante digitou (ex.: www.cliente.com). */
export const PAGES_EDGE_SITE_HOST_HEADER = "x-pages-site-host";
/** Rota interna que desenha o site de um domínio próprio; nunca é acessível direto. */
export const EDGE_SITES_PATH_PREFIX = "/edge-sites";

const CUSTOM_DOMAIN_PATTERN = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

/** Normaliza o host recebido e devolve `null` se não tiver formato de domínio. */
export function toValidCustomDomain(rawHost: string | null | undefined): string | null {
  if (!rawHost) return null;
  const host = rawHost.trim().toLowerCase().replace(/:\d+$/, "");
  return CUSTOM_DOMAIN_PATTERN.test(host) ? host : null;
}

/** O domínio cadastrado pode estar com ou sem `www`: o site responde nos dois. */
export function customDomainCandidates(host: string): string[] {
  return host.startsWith("www.") ? [host, host.slice("www.".length)] : [host, `www.${host}`];
}
