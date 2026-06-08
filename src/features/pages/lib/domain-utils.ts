/**
 * Utilitários de domínio das NASA Pages — compartilhados entre o
 * middleware (edge runtime), o registro de domínio (`set-custom-domain`)
 * e a verificação (`verify-custom-domain` + Inngest).
 *
 * IMPORTANTE: este módulo precisa ser **edge-safe** — nada de imports de
 * Prisma, auth ou APIs Node. Só lógica pura + `process.env.NEXT_PUBLIC_*`
 * (inlinado no build, disponível no edge). O middleware importa daqui.
 */

/** Domínio válido (apex `meusite.com` ou subdomínio `www.meusite.com`). */
export const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

/** Host principal da plataforma (ex: `nasaex.com`). */
export const PRIMARY_HOST = (
  process.env.NEXT_PUBLIC_PRIMARY_HOST ?? "nasaex.com"
).toLowerCase();

/** IPv4 literal — não pode virar custom domain. */
const IPV4_REGEX = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * `true` quando o host pertence à plataforma e NÃO deve ser reescrito pra
 * `/_sites`. Cobre o host principal, seus subdomínios (`orbita.`, `app.`,
 * `pages.`…) e hosts de dev/preview. Host vazio também conta como
 * plataforma (segue o fluxo normal do app).
 */
export function isPlatformHost(host: string): boolean {
  if (!host) return true;
  if (host === PRIMARY_HOST || host.endsWith(`.${PRIMARY_HOST}`)) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".localhost")) return true;
  if (host.endsWith(".ngrok-free.dev") || host.endsWith(".vercel.app")) return true;
  return false;
}

/**
 * `true` quando o domínio é proibido como `customDomain` — host da
 * plataforma (evita hijack de `pages.nasaex.com` etc), localhost ou IP
 * literal. Usado pelo `set-custom-domain` como blocklist.
 */
export function isBlockedCustomDomain(domain: string): boolean {
  const host = domain.toLowerCase();
  if (isPlatformHost(host)) return true;
  if (IPV4_REGEX.test(host)) return true;
  return false;
}
