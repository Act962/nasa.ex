/**
 * Helpers de tracking de origem (client-side).
 *
 * Capturam UTMs da URL atual + persistem em sessionStorage para sobreviverem
 * entre páginas dentro da mesma sessão. O middleware também grava em cookie
 * httpOnly `nasa_tracking` para o servidor ler diretamente.
 *
 * Uso típico em Client Components:
 *   const tracking = getTrackingParamsClient();
 *   await orpc.form.submitResponse({ ..., tracking });
 */
import { z } from "zod";

const STORAGE_KEY = "nasa:tracking";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export interface TrackingParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPage?: string;
  device?: string; // mobile | desktop | tablet
  userAgent?: string;
}

/**
 * Schema Zod compartilhado por TODAS as procedures que recebem tracking
 * (form/public/submit, agenda/create, linnker/capture, leads/create, etc).
 * Mantido aqui pra não duplicar em N arquivos.
 */
export const trackingParamsSchema = z
  .object({
    utmSource: z.string().max(200).optional(),
    utmMedium: z.string().max(200).optional(),
    utmCampaign: z.string().max(200).optional(),
    utmContent: z.string().max(200).optional(),
    utmTerm: z.string().max(200).optional(),
    referrer: z.string().max(500).optional(),
    landingPage: z.string().max(500).optional(),
    device: z.string().max(40).optional(),
    userAgent: z.string().max(500).optional(),
  })
  .partial();

/**
 * Mapeia tracking params direto pros campos do `Lead.create({ data })`.
 * Retorna apenas chaves não-undefined pra spread limpo.
 */
export function trackingToLeadData(t: TrackingParams | undefined | null) {
  if (!t) return {};
  return {
    utmSource: t.utmSource,
    utmMedium: t.utmMedium,
    utmCampaign: t.utmCampaign,
    utmContent: t.utmContent,
    utmTerm: t.utmTerm,
    referrer: t.referrer,
    landingPage: t.landingPage,
    device: t.device,
  };
}

/** True quando o tracking tem informação suficiente pra registrar um `utm_landing`. */
export function shouldLogUtmLanding(t: TrackingParams | undefined | null): boolean {
  return !!(t?.utmSource || t?.utmCampaign);
}

/** Faz parse "barebones" do UA pra device tier. Sem pegada de dependência. */
export function parseDevice(userAgent: string | undefined | null): "mobile" | "desktop" | "tablet" {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "desktop";
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|iphone|android.*mobile|phone/.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Captura UTMs do `window.location` atual + persiste em sessionStorage.
 * Idempotente: se já há um tracking salvo na sessão, mantém o original
 * (preserva o "primeiro touch" durante a navegação).
 */
export function captureTrackingParamsClient(): TrackingParams {
  if (typeof window === "undefined") return {};

  const stored = readStoredTracking();
  if (stored && Object.keys(stored).length > 0) {
    // Mantém primeiro touch — não sobrescreve com nova visita
    return stored;
  }

  const sp = new URLSearchParams(window.location.search);
  const tracking: TrackingParams = {};

  for (const key of UTM_KEYS) {
    const v = sp.get(key);
    if (!v) continue;
    const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()) as keyof TrackingParams;
    (tracking as Record<string, string>)[camel] = v.slice(0, 200);
  }

  tracking.landingPage = window.location.pathname + window.location.search;
  tracking.referrer = document.referrer || undefined;
  tracking.userAgent = navigator.userAgent;
  tracking.device = parseDevice(navigator.userAgent);

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tracking));
  } catch {
    // Browser sem sessionStorage / private mode
  }

  return tracking;
}

/** Lê tracking persistido na sessão (sem captura nova). */
export function getTrackingParamsClient(): TrackingParams {
  if (typeof window === "undefined") return {};
  const stored = readStoredTracking();
  if (stored && Object.keys(stored).length > 0) return stored;
  // Se nada foi capturado ainda, faz captura on-demand
  return captureTrackingParamsClient();
}

function readStoredTracking(): TrackingParams | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TrackingParams;
  } catch {
    return null;
  }
}
