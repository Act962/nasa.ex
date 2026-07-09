/**
 * Constantes do builder de templates de marketing (Campanhas — Fase 2).
 * Limites espelham os da Meta pra validar no client antes de mandar pra análise.
 */

export const TEMPLATE_LIMITS = {
  name: 512,
  headerText: 60,
  bodyText: 1024,
  footerText: 60,
  buttonText: 25,
  quickReplyText: 25,
  urlButtonText: 25,
  phoneButtonText: 25,
  copyCodeText: 25,
  url: 2000,
  maxButtons: 10,
  maxUrlButtons: 2,
  maxPhoneButtons: 1,
  maxCopyCodeButtons: 1,
  maxHeaderVariables: 1,
} as const;

/**
 * Marketing + Utilidade. Autenticação fica pra depois — o contrato já aceita
 * novas categorias sem reescrever. Utilidade tem regras de conteúdo estritas:
 * material promocional faz a Meta re-categorizar como marketing.
 */
export const TEMPLATE_CATEGORIES = [
  {
    value: "MARKETING",
    label: "Marketing",
    description:
      "Promoções, ofertas, novidades e anúncios. Requer opt-in do contato.",
  },
  {
    value: "UTILITY",
    label: "Utilidade",
    description:
      "Mensagens sobre uma conta ou pedido existente: confirmações, status, recibos e lembretes. Não pode ter material promocional.",
  },
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]["value"];

/** Idiomas mais usados no WhatsApp — `pt_BR` primeiro (default do produto). */
export const TEMPLATE_LANGUAGES = [
  { code: "pt_BR", label: "Português (BR)" },
  { code: "pt_PT", label: "Português (PT)" },
  { code: "en_US", label: "Inglês (EUA)" },
  { code: "en_GB", label: "Inglês (Reino Unido)" },
  { code: "es_ES", label: "Espanhol (Espanha)" },
  { code: "es_MX", label: "Espanhol (México)" },
  { code: "es_AR", label: "Espanhol (Argentina)" },
  { code: "fr_FR", label: "Francês" },
  { code: "it_IT", label: "Italiano" },
  { code: "de_DE", label: "Alemão" },
] as const;

export const DEFAULT_TEMPLATE_LANGUAGE = "pt_BR";

/** Extensões/MIME aceitos por formato de header de mídia. */
export const HEADER_MEDIA_ACCEPT: Record<string, string> = {
  IMAGE: "image/jpeg,image/png",
  VIDEO: "video/mp4,video/3gpp",
  DOCUMENT: "application/pdf",
};

export const HEADER_MEDIA_MAX_BYTES = 16 * 1024 * 1024;

export function languageLabel(code: string): string {
  return TEMPLATE_LANGUAGES.find((language) => language.code === code)?.label ?? code;
}
