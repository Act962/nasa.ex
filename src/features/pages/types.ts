export type Device = "desktop" | "tablet" | "mobile";

export type PageStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type PageIntent =
  | "INSTITUTIONAL"
  | "LANDING"
  | "BIO_LINK"
  | "EVENT"
  | "PRODUCT"
  | "PORTFOLIO"
  | "CUSTOM"
  | "SPACE_PAGE";

export type DomainStatus = "PENDING" | "VERIFIED" | "FAILED";
export type DomainSource = "EXTERNAL" | "PURCHASED_VIA_NASA";
export type DomainPurchaseStatus =
  | "NOT_STARTED"
  | "SEARCHING"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "REGISTERING"
  | "ACTIVE"
  | "FAILED";

export interface AnimationPreset {
  preset: string;
  trigger: "entrance" | "hover" | "scroll";
  durationMs?: number;
  delayMs?: number;
  easing?: string;
}

/**
 * Catálogo de animações disponíveis. Cada preset mapeia pra uma
 * keyframe CSS em `animations.css`. Usado no properties panel pra
 * popular o dropdown.
 */
export const ANIMATION_PRESET_IDS = [
  "fade",
  "slide-up",
  "slide-down",
  "slide-left",
  "slide-right",
  "zoom-in",
  "zoom-out",
  "bounce",
  "pulse",
  "shake",
  "glow",
  "float",
  "spin",
  "marquee",
  "flow",
] as const;
export type AnimationPresetId = (typeof ANIMATION_PRESET_IDS)[number];

/**
 * Design tokens — paleta + tipografia + espaçamento centralizados.
 * Cada page tem uma `tokens` que seções consomem. Permite trocar
 * cor da marca uma vez e refletir em tudo.
 */
export interface DesignTokens {
  colors?: {
    primary?: string;
    accent?: string;
    bg?: string;
    fg?: string;
    muted?: string;
    danger?: string;
    success?: string;
  };
  /** Gradientes nomeados — referenciáveis via "gradient.primary" em sections. */
  gradients?: Record<string, string>;
  /** Família de fontes — default Inter. */
  fontFamily?: string;
  /** Tamanho base (px) — escala usa multiplicadores. */
  fontSizeBase?: number;
  /** Border radius padrão pra cards e botões. */
  radiusBase?: number;
}

export interface LinkTarget {
  kind:
    | "url"
    | "tracking"
    | "form"
    | "agenda"
    | "linnker"
    | "chat"
    | "payment"
    | "forge"
    | "page";
  href?: string;
  resourceId?: string;
  openInNewTab?: boolean;
}

export interface ParallaxConfig {
  enabled?: boolean;
  speed?: number;
  direction?: "up" | "down";
}

export interface ResponsiveOverrides {
  tablet?: Partial<ElementBase>;
  mobile?: Partial<ElementBase>;
  hiddenOn?: Device[];
}

export interface ElementBase {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number;
  zIndex?: number;
  locked?: boolean;
  hidden?: boolean;
  animation?: AnimationPreset;
  link?: LinkTarget;
  parallax?: ParallaxConfig;
  responsive?: ResponsiveOverrides;
  [key: string]: unknown;
}

export type ElementType =
  // ── Átomos (existiam antes) ──
  | "text"
  | "image"
  | "svg"
  | "shape"
  | "divider"
  | "icon"
  | "button"
  | "video"
  | "social"
  | "spacer"
  | "nasa-link"
  | "embed"
  | "group"
  // ── Sections completas (Fase 1) ──
  // Mega-blocos pré-montados — user arrasta e edita inline.
  // Cada section traz layout pronto + sub-elementos editáveis.
  | "section-hero"
  | "section-features"
  | "section-pricing"
  | "section-cta"
  | "section-stats"
  | "section-testimonials"
  | "section-faq"
  | "section-logo-cloud"
  // Estrutura global da landing
  | "section-navbar"
  | "section-footer"
  // ── Blocos interativos (Fase 2) ──
  | "marquee"
  | "tabs"
  | "accordion"
  | "counter"
  | "carousel"
  // ── Lead capture & engagement (Fase 6) ──
  | "chat-button"
  | "embedded-form"
  | "exit-intent"
  // ── Marketing toolkit (Fase 7) ──
  // Singleton com táticas de conversão: social-proof toasts,
  // countdown de desconto, visitantes online, sticky CTA, scarcity.
  | "marketing"
  // ── Data binding (Fase 5) ──
  // Renderiza dados do app em tempo real (planos, cursos, leaderboard).
  | "data-bound";

/**
 * Categorias usadas no builder pra agrupar elementos no sidebar.
 * Adicionar elemento? Inclua aqui sua categoria também.
 */
export const ELEMENT_CATEGORIES = {
  basic: "Básicos",
  sections: "Sections prontas",
  interactive: "Interativos",
  app: "Apps NASA",
  data: "Dados ao vivo",
} as const;
export type ElementCategory = keyof typeof ELEMENT_CATEGORIES;

/**
 * Origens de dados pra elementos data-bound. Cada bloco data-bound
 * referencia um destes — server-side resolve query do oRPC e injeta
 * no render.
 */
export type DataSourceKind =
  | "plans-list"
  | "nasa-route-courses"
  | "space-points-leaderboard"
  | "org-stats"
  | "tag-counts";

export interface DataBindingConfig {
  source: DataSourceKind;
  /** Limita quantos registros mostra (default 10). */
  limit?: number;
  /** Variant visual: como o array de dados é renderizado. */
  layout?: "grid" | "list" | "table" | "carousel";
  /** Filtros simples passados pra query. */
  filters?: Record<string, string | number | boolean>;
}

export interface Layer {
  elements: ElementBase[];
  background?: { color?: string; image?: string };
}

export interface Artboard {
  width: number;
  minHeight: number;
  background?: string;
}

export interface PageMeta {
  title?: string;
  description?: string;
  favicon?: string;
  og?: string;
}

export type PageLayout =
  | {
      mode: "single";
      main: Layer;
      artboard: Artboard;
      meta?: PageMeta;
      sections?: unknown[];
      tokens?: DesignTokens;
    }
  | {
      mode: "stacked";
      back: Layer;
      front: Layer;
      artboard: Artboard;
      meta?: PageMeta;
      sections?: unknown[];
      parallax: { backSpeed: number; frontSpeed: number };
      tokens?: DesignTokens;
    };

export interface NasaPageSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  intent: PageIntent;
  status: PageStatus;
  layerCount: number;
  customDomain: string | null;
  domainStatus: DomainStatus | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
