import { NextRequest, NextResponse } from "next/server";

const REF_COOKIE = "nasa_ref";
const TRACKING_COOKIE = "nasa_tracking";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/**
 * Middleware Edge — captura:
 *  1. `?ref=<code>` para o programa de parceria (cookie httpOnly `nasa_ref`)
 *  2. `?utm_*` para tracking de origem do lead (cookie httpOnly `nasa_tracking`)
 *
 * O cookie de tracking é JSON-encoded com `{ utmSource, utmMedium, utmCampaign,
 * utmContent, utmTerm, referrer, landingPage }`. É lido server-side em todas as
 * rotas de criação de lead (form submit, agenda, linnker, etc.) via
 * `extractTracking()`.
 *
 * NÃO registramos a visita aqui (lookups de DB são caros no edge runtime).
 */
export function middleware(req: NextRequest) {
  const url = req.nextUrl;
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
  // Matcher amplo cobrindo todos os entrypoints públicos onde pode aparecer
  // UTMs. Excluímos APIs e estáticos pra reduzir overhead no edge.
  matcher: [
    "/sign-up",
    "/sign-in",
    "/",
    "/submit-form/:path*",
    "/agenda/:path*",
    "/calendario/:path*",
    "/c/:path*",
    "/s/:path*",
    "/pages/:path*",
    "/portal/:path*",
    "/profile/:path*",
    "/proposta/:path*",
    "/contrato/:path*",
    "/checkout/:path*",
    "/space/:path*",
    "/l/:path*",
    "/join/:path*",
    "/resgatar/:path*",
  ],
};
