import type { Device, PageIntent } from "./types";

export const STARS_COST = 2000;

export const DEVICE_PRESETS: Record<Device, { width: number; label: string }> = {
  desktop: { width: 1440, label: "Desktop" },
  tablet:  { width: 1024, label: "Tablet" },
  mobile:  { width: 375,  label: "Mobile" },
};

export const INTENT_LABELS: Record<PageIntent, string> = {
  INSTITUTIONAL: "Site institucional",
  LANDING:       "Landing page",
  BIO_LINK:      "Bio link",
  EVENT:         "Evento",
  PRODUCT:       "Produto",
  PORTFOLIO:     "Portfólio",
  CUSTOM:        "Personalizado",
  SPACE_PAGE:    "Space Page",
};

export const INTENT_DESCRIPTIONS: Record<PageIntent, string> = {
  INSTITUTIONAL: "Apresentação da empresa e áreas de atuação",
  LANDING:       "Captar leads ou conversões em uma ação específica",
  BIO_LINK:      "Agregar seus links principais num só lugar",
  EVENT:         "Divulgar um evento ao vivo ou online",
  PRODUCT:       "Divulgar um produto ou serviço",
  PORTFOLIO:     "Mostrar projetos realizados",
  CUSTOM:        "Comece do zero, do seu jeito",
  SPACE_PAGE:    "Página oficial da empresa na rede",
};

export const ELEMENT_TYPES = [
  // Átomos
  "text", "image", "svg", "shape", "divider", "icon", "button",
  "video", "social", "spacer", "nasa-link", "embed",
  // Sections completas (Fase 1)
  "section-hero", "section-features", "section-pricing", "section-cta",
  "section-stats", "section-testimonials", "section-faq", "section-logo-cloud",
  "section-navbar", "section-footer",
  // Blocos interativos (Fase 2)
  "marquee", "tabs", "accordion", "counter",
  // Data binding (Fase 5)
  "data-bound",
] as const;

/**
 * Mapeia ElementType → categoria do sidebar do builder.
 */
export const ELEMENT_TYPE_CATEGORIES: Record<string, string> = {
  text: "basic", image: "basic", svg: "basic", shape: "basic",
  divider: "basic", icon: "basic", button: "basic", video: "basic",
  social: "basic", spacer: "basic", embed: "basic",
  "section-hero": "sections", "section-features": "sections",
  "section-pricing": "sections", "section-cta": "sections",
  "section-stats": "sections", "section-testimonials": "sections",
  "section-faq": "sections", "section-logo-cloud": "sections",
  "section-navbar": "sections", "section-footer": "sections",
  marquee: "interactive", tabs: "interactive",
  accordion: "interactive", counter: "interactive",
  "nasa-link": "app",
  "data-bound": "data",
};

/**
 * Labels visuais (ícone + texto) por ElementType — usado nos botões
 * do sidebar do builder.
 */
export const ELEMENT_TYPE_LABELS: Record<
  string,
  { label: string; icon: string }
> = {
  text: { label: "Texto", icon: "📝" },
  image: { label: "Imagem", icon: "🖼" },
  svg: { label: "SVG", icon: "🎨" },
  shape: { label: "Forma", icon: "▭" },
  divider: { label: "Linha", icon: "—" },
  icon: { label: "Ícone", icon: "⭐" },
  button: { label: "Botão", icon: "🔘" },
  video: { label: "Vídeo", icon: "🎥" },
  social: { label: "Social", icon: "🌐" },
  spacer: { label: "Espaço", icon: "↕" },
  embed: { label: "Embed", icon: "<>" },
  "nasa-link": { label: "Link NASA", icon: "🚀" },
  "section-hero": { label: "Hero", icon: "🎯" },
  "section-features": { label: "Features", icon: "✨" },
  "section-pricing": { label: "Planos", icon: "💎" },
  "section-cta": { label: "CTA Final", icon: "📢" },
  "section-stats": { label: "Stats", icon: "📊" },
  "section-testimonials": { label: "Depoimentos", icon: "💬" },
  "section-faq": { label: "FAQ", icon: "❓" },
  "section-logo-cloud": { label: "Logos", icon: "🏷" },
  "section-navbar": { label: "Header", icon: "🧭" },
  "section-footer": { label: "Footer", icon: "📜" },
  marquee: { label: "Carrossel", icon: "🎠" },
  tabs: { label: "Abas", icon: "📑" },
  accordion: { label: "Accordion", icon: "📂" },
  counter: { label: "Contador", icon: "🔢" },
  "data-bound": { label: "Dados ao vivo", icon: "🔌" },
};

export const DEFAULT_PALETTES: Array<Record<string, string>> = [
  { primary: "#6366f1", accent: "#a78bfa", bg: "#0f172a", fg: "#f8fafc", muted: "#64748b" },
  { primary: "#10b981", accent: "#34d399", bg: "#ffffff", fg: "#0b132b", muted: "#64748b" },
  { primary: "#f97316", accent: "#fb923c", bg: "#fff7ed", fg: "#1c1917", muted: "#78716c" },
  { primary: "#ec4899", accent: "#f472b6", bg: "#0b1020", fg: "#f8fafc", muted: "#94a3b8" },
  { primary: "#0ea5e9", accent: "#38bdf8", bg: "#f8fafc", fg: "#0f172a", muted: "#64748b" },
];

export const ANIMATION_PRESETS = [
  { id: "fade",        label: "Fade" },
  { id: "slide-up",    label: "Slide up" },
  { id: "slide-down",  label: "Slide down" },
  { id: "slide-left",  label: "Slide left" },
  { id: "slide-right", label: "Slide right" },
  { id: "zoom-in",     label: "Zoom in" },
  { id: "zoom-out",    label: "Zoom out" },
  { id: "bounce",      label: "Bounce" },
  { id: "flip",        label: "Flip" },
] as const;
