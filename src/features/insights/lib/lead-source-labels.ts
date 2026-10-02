/** Nome amigável de cada `LeadSource` para gráficos e rankings do Insights. */
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  DEFAULT: "Manual",
  WHATSAPP: "WhatsApp",
  FORM: "Formulário",
  AGENDA: "Agenda",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  GMAIL: "Gmail",
  GOOGLE_MAPS: "Google Maps",
  IN_CHAT: "Chat",
  ASTRO_CHAT: "Chat do ASTRO",
  NERP_CATALOG: "Catálogo NERP",
  OTHER: "Outro",
};

export function leadSourceLabel(source: string): string {
  return LEAD_SOURCE_LABELS[source] ?? source;
}
