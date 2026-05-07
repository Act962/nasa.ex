/**
 * Extrai dados de tracking de origem (UTMs, referrer, device) a partir de
 * headers/cookies da request. Usado em rotas server-side de criação de Lead
 * (form public submit, agenda, linnker, etc.) para popular os campos `utm*`,
 * `referrer`, `landingPage`, `device`, `userAgent` no Lead.
 *
 * Lê o cookie httpOnly `nasa_tracking` setado pelo `middleware.ts`.
 */
import { parseDevice, type TrackingParams } from "./tracking-params";

/**
 * Reader minimal compatível com Next `RequestCookies`, `Headers`, e qualquer
 * outro container key→value. Aceita variações de retorno (`undefined` vs `null`,
 * `{ value }` vs string direto).
 */
interface ValueReader {
  get(name: string): { value?: string } | string | null | undefined;
}

export interface ExtractTrackingInput {
  cookies?: ValueReader;
  headers?: ValueReader;
  /** Tracking enviado explicitamente pelo client no body do request — tem prioridade. */
  explicit?: TrackingParams | null;
}

function readValue(reader: ValueReader | undefined, key: string): string | undefined {
  const raw = reader?.get(key);
  if (!raw) return undefined;
  if (typeof raw === "string") return raw;
  return raw.value;
}

/**
 * Server-side: lê tracking do cookie + headers, com fallback pro `explicit`
 * passado no body.
 *
 * Retorna apenas chaves não-vazias para spread direto em `prisma.lead.create({ data: ... })`.
 */
export function extractTracking(input: ExtractTrackingInput): TrackingParams {
  // 1. Tracking explícito do client tem prioridade — ele já capturou via
  // sessionStorage e pode incluir UTMs do "primeiro touch" da sessão.
  const fromBody: TrackingParams = input.explicit ?? {};

  // 2. Cookie nasa_tracking (setado pelo middleware na primeira visita)
  let fromCookie: TrackingParams = {};
  const cookieVal = readValue(input.cookies, "nasa_tracking");
  if (cookieVal) {
    try {
      fromCookie = JSON.parse(decodeURIComponent(cookieVal)) as TrackingParams;
    } catch {
      // cookie malformado — ignora
    }
  }

  // 3. Headers (User-Agent, Referer)
  const userAgent = readValue(input.headers, "user-agent");
  const referer = readValue(input.headers, "referer");

  const merged: TrackingParams = {
    utmSource: fromBody.utmSource ?? fromCookie.utmSource,
    utmMedium: fromBody.utmMedium ?? fromCookie.utmMedium,
    utmCampaign: fromBody.utmCampaign ?? fromCookie.utmCampaign,
    utmContent: fromBody.utmContent ?? fromCookie.utmContent,
    utmTerm: fromBody.utmTerm ?? fromCookie.utmTerm,
    referrer: fromBody.referrer ?? fromCookie.referrer ?? referer ?? undefined,
    landingPage: fromBody.landingPage ?? fromCookie.landingPage ?? undefined,
    userAgent: fromBody.userAgent ?? userAgent ?? undefined,
    device: fromBody.device ?? fromCookie.device ?? parseDevice(userAgent),
  };

  // Remove chaves undefined pra ficar limpo no spread
  return Object.fromEntries(
    Object.entries(merged).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
}

/**
 * Tipo Zod-friendly do schema esperado no body de procedures que recebem tracking.
 * Use em `z.object({ tracking: trackingParamsSchema.optional() })`.
 */
export const TRACKING_FIELDS = [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "referrer",
  "landingPage",
  "device",
  "userAgent",
] as const;
