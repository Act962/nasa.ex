import { NextRequest, NextResponse } from "next/server";
import {
  LEAD_TRACKING_COOKIE as TRACKING_COOKIE,
  PARTNER_REFERRAL_COOKIE as REF_COOKIE,
} from "@/features/legal/lib/orbita-cookies";
import {
  EDGE_SITES_PATH_PREFIX,
  PAGES_EDGE_SECRET_HEADER,
  PAGES_EDGE_SITE_HOST_HEADER,
  toValidCustomDomain,
} from "@/features/pages/lib/edge-headers";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/**
 * Proxy (antigo Middleware, renomeado no Next 16.3) — captura:
 *  1. `?ref=<code>` para o programa de parceria (cookie httpOnly `nasa_ref`)
 *  2. `?utm_*` para tracking de origem do lead (cookie httpOnly `nasa_tracking`)
 *
 * O cookie de tracking é JSON-encoded com `{ utmSource, utmMedium, utmCampaign,
 * utmContent, utmTerm, referrer, landingPage }`. É lido server-side em todas as
 * rotas de criação de lead (form submit, agenda, linnker, etc.) via
 * `extractTracking()`.
 *
 * NÃO registramos a visita aqui — roda antes de toda request casada pelo
 * matcher, então lookups de DB pesariam em cada navegação.
 */
// Entradas públicas onde ?ref e ?utm_* são capturados (era o matcher antes de ele cobrir tudo).
const TRACKED_EXACT_PATHS = new Set(["/", "/sign-up", "/sign-in"]);
const TRACKED_PATH_PREFIXES = [
  "/submit-form/", "/agenda/", "/calendario/", "/c/", "/s/", "/pages/", "/portal/", "/profile/",
  "/proposta/", "/contrato/", "/checkout/", "/space/", "/l/", "/join/", "/resgatar/", "/trafego/",
];

function isTrackedPath(pathname: string): boolean {
  return TRACKED_EXACT_PATHS.has(pathname) || TRACKED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Domínio próprio de um site do Pages. A portaria (orbita-pages-edge) manda o domínio do
 * visitante e um segredo; só então o caminho é reescrito para a rota interna dos sites.
 * Sem o segredo, tanto o cabeçalho forjado quanto o acesso direto à rota interna dão 404.
 * Devolve `null` quando a requisição não tem nada a ver com domínio próprio.
 */
function handleCustomDomainSite(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname;
  const siteHostHeader = req.headers.get(PAGES_EDGE_SITE_HOST_HEADER);
  const isInternalSitesPath = pathname === EDGE_SITES_PATH_PREFIX || pathname.startsWith(`${EDGE_SITES_PATH_PREFIX}/`);
  if (!siteHostHeader && !isInternalSitesPath) return null;

  const edgeSecret = process.env.PAGES_EDGE_SECRET;
  const isFromEdge = Boolean(edgeSecret) && req.headers.get(PAGES_EDGE_SECRET_HEADER) === edgeSecret;
  const customDomain = toValidCustomDomain(siteHostHeader);
  if (!isFromEdge || isInternalSitesPath || !customDomain) {
    return new NextResponse(null, { status: 404 });
  }

  const rewriteUrl = req.nextUrl.clone();
  rewriteUrl.pathname = `${EDGE_SITES_PATH_PREFIX}/${customDomain}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(rewriteUrl);
}

export function proxy(req: NextRequest) {
  const customDomainResponse = handleCustomDomainSite(req);
  if (customDomainResponse) return customDomainResponse;

  const url = req.nextUrl;
  if (!isTrackedPath(url.pathname)) return NextResponse.next();

  const ref = url.searchParams.get("ref");

  // Captura UTMs se presentes
  const utmEntries = UTM_KEYS.map((k) => [k, url.searchParams.get(k)] as const).filter(
    ([, v]) => !!v,
  );

  // Atalho: nada a fazer
  if (!ref && utmEntries.length === 0) return NextResponse.next();

  const res = NextResponse.next();

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
    const sanitize = (val: string | null) =>
      (val ?? "").replace(/[\r\n\t]/g, "").slice(0, 200);

    // Camel-case keys para combinar com Prisma fields
    const tracking: Record<string, string | undefined> = {};
    for (const [k, v] of utmEntries) {
      const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      tracking[camel] = sanitize(v);
    }
    tracking.landingPage = sanitize(url.pathname + url.search);
    tracking.referrer = sanitize(req.headers.get("referer"));

    // Não re-seta o cookie se o conteúdo não mudou — evita escrita desnecessária
    // em refreshes da mesma URL.
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

  return res;
}

export const config = {
  // Cobre todas as páginas (um site de domínio próprio pode ter qualquer caminho); a captura
  // de UTMs segue restrita a `isTrackedPath`. APIs e estáticos ficam de fora.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
