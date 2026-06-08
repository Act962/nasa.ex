import { NextRequest, NextResponse } from "next/server";
import { DOMAIN_REGEX, isPlatformHost } from "@/features/pages/lib/domain-utils";

const REF_COOKIE = "nasa_ref";
const TRACKING_COOKIE = "nasa_tracking";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/**
 * Captura `?ref=` (parceria) e `?utm_*` (origem do lead) em cookies
 * httpOnly, mutando a `res` recebida. Extraída numa função porque agora
 * roda tanto no fluxo normal quanto no rewrite de domínio customizado
 * (uma landing em domínio próprio também pode chegar com UTMs).
 *
 * No-op quando não há `ref` nem UTMs — não escreve cookie à toa.
 */
function applyTrackingCookies(req: NextRequest, res: NextResponse): void {
  const url = req.nextUrl;
  const ref = url.searchParams.get("ref");
  const utmEntries = UTM_KEYS.map((key) => [key, url.searchParams.get(key)] as const).filter(
    ([, value]) => !!value,
  );

  if (!ref && utmEntries.length === 0) return;

  // ── Referral parceiro ────────────────────────────────
  if (ref) {
    const safe = ref.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
    if (safe) {
      res.cookies.set({
        name: REF_COOKIE,
        value: safe,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE_SECONDS,
        path: "/",
      });
      res.headers.set("x-nasa-ref-captured", safe);
    }
  }

  // ── UTMs / origem ─────────────────────────────────────
  if (utmEntries.length > 0) {
    const sanitize = (value: string | null) =>
      (value ?? "").replace(/[\r\n\t]/g, "").slice(0, 200);

    // Camel-case keys para combinar com Prisma fields
    const tracking: Record<string, string | undefined> = {};
    for (const [key, value] of utmEntries) {
      const camel = key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
      tracking[camel] = sanitize(value);
    }
    tracking.landingPage = sanitize(url.pathname + url.search);
    tracking.referrer = sanitize(req.headers.get("referer"));

    // Não re-seta o cookie se o conteúdo não mudou — evita escrita
    // desnecessária em refreshes da mesma URL.
    const newCookieValue = encodeURIComponent(JSON.stringify(tracking));
    if (req.cookies.get(TRACKING_COOKIE)?.value !== newCookieValue) {
      res.cookies.set({
        name: TRACKING_COOKIE,
        value: newCookieValue,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE_SECONDS,
        path: "/",
      });
    }
  }
}

/**
 * Middleware Edge. Duas responsabilidades:
 *
 *  1. **Roteamento de domínio dinâmico** — quando a requisição chega num
 *     domínio customizado (não-plataforma), reescreve `meusite.com/<path>`
 *     → `/_sites/meusite.com/<path>` pra que a rota catch-all
 *     `_sites/[host]/[[...path]]` sirva a NASA Page com aquele
 *     `customDomain`. O host da plataforma (`nasaex.com` e subdomínios)
 *     segue o fluxo normal.
 *
 *  2. **Tracking** — captura `?ref=` e `?utm_*` em cookies (`applyTrackingCookies`).
 */
export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Host efetivo (Traefik/proxy repassa o original em x-forwarded-host).
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .toLowerCase()
    .split(":")[0];

  // ── Rewrite por domínio customizado ───────────────────
  // Guard de loop (`/_sites` já reescrito), allowlist da plataforma e
  // validação do host (anti path-traversal em `/_sites/${host}`).
  const isCustomDomain =
    !url.pathname.startsWith("/_sites") &&
    !isPlatformHost(host) &&
    DOMAIN_REGEX.test(host);

  if (isCustomDomain) {
    const rewriteUrl = url.clone();
    rewriteUrl.pathname = `/_sites/${host}${url.pathname === "/" ? "" : url.pathname}`;
    const res = NextResponse.rewrite(rewriteUrl);
    applyTrackingCookies(req, res);
    return res;
  }

  const res = NextResponse.next();
  applyTrackingCookies(req, res);
  return res;
}

export const config = {
  // Matcher global: o rewrite de domínio customizado bate em `/` e em
  // qualquer subpath, então não dá pra usar allow-list de rotas. Excluímos
  // APIs, assets do Next e arquivos estáticos (com extensão) pra reduzir
  // overhead. A captura de UTM continua acontecendo nas rotas públicas
  // (todas casam aqui).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
