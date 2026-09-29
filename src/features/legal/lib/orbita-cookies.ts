/**
 * Registro único dos cookies e armazenamentos do Órbita. O proxy lê os nomes
 * daqui, e a Política de Cookies é renderizada a partir desta lista — cookie
 * novo que não passar por aqui não aparece na política.
 */

export type OrbitaCookieCategory = "necessary" | "analytics" | "advertising" | "personalization";

export interface OrbitaCookieDefinition {
  name: string;
  category: OrbitaCookieCategory;
  provider: string;
  purpose: string;
  duration: string;
  storage: "cookie" | "localStorage" | "sessionStorage";
}

export const PARTNER_REFERRAL_COOKIE = "nasa_ref";
export const LEAD_TRACKING_COOKIE = "nasa_tracking";
export const PRIVACY_CONSENT_STORAGE_KEY = "orbita-privacy-consent";

export const ORBITA_COOKIE_CATEGORY_LABELS: Record<OrbitaCookieCategory, string> = {
  necessary: "Necessários",
  analytics: "Análise",
  advertising: "Publicidade",
  personalization: "Personalização",
};

export const ORBITA_COOKIES: OrbitaCookieDefinition[] = [
  {
    name: "better-auth.session_token",
    category: "necessary",
    provider: "Órbita",
    purpose: "Mantém você conectado com segurança.",
    duration: "Até sair da conta ou a sessão expirar",
    storage: "cookie",
  },
  {
    name: PARTNER_REFERRAL_COOKIE,
    category: "necessary",
    provider: "Órbita",
    purpose: "Registra o parceiro que indicou você, para o programa de parceria.",
    duration: "30 dias",
    storage: "cookie",
  },
  {
    name: LEAD_TRACKING_COOKIE,
    category: "necessary",
    provider: "Órbita",
    purpose: "Guarda a origem do acesso (UTM, página de entrada) para atribuir leads à campanha certa.",
    duration: "30 dias",
    storage: "cookie",
  },
  {
    name: PRIVACY_CONSENT_STORAGE_KEY,
    category: "necessary",
    provider: "Órbita",
    purpose: "Lembra as suas escolhas de privacidade.",
    duration: "Até você limpar os dados do navegador",
    storage: "localStorage",
  },
  {
    name: "astro-widget-session",
    category: "necessary",
    provider: "Órbita",
    purpose: "Retoma a conversa aberta com o ASTRO depois de recarregar a página.",
    duration: "Até fechar a aba",
    storage: "sessionStorage",
  },
  {
    name: "ph_<chave>_posthog",
    category: "analytics",
    provider: "PostHog",
    purpose: "Mede o uso da plataforma e grava sessões para encontrarmos erros.",
    duration: "1 ano",
    storage: "cookie",
  },
];
