/**
 * builder-sidebar-config — tabelas estáticas da sidebar do builder.
 *
 * Centraliza os "dados" que descrevem os elementos disponíveis na aba
 * Elementos, sem nenhuma lógica de UI:
 *
 * - `ICONS`            → ícone (lucide) de cada ElementType.
 * - `LABELS`           → rótulo em pt-BR de cada ElementType.
 * - `ELEMENT_ORDER`    → ordem em que os elementos aparecem na aba.
 * - `SINGLETON_TYPES`  → tipos que só podem existir 1× por page.
 * - `SINGLETON_LABELS` → rótulo amigável usado no toast de singleton.
 * - `Tab`              → união das abas da sidebar.
 *
 * Mantido como `.ts` puro (sem JSX) pra poder ser importado tanto pelo
 * componente quanto por helpers/testes sem arrastar React DOM junto.
 */
import {
  Type,
  Image as ImageIcon,
  Square,
  Minus,
  MousePointerClick,
  Video as VideoIcon,
  Share2,
  Link as LinkIcon,
  Code2,
  Star as StarIcon,
  Shapes,
  SquareStack,
  LayoutTemplate,
  LayoutGrid,
  DollarSign,
  Megaphone,
  BarChart3,
  Quote,
  HelpCircle,
  Building2,
  MoveHorizontal,
  Layers,
  Rows3,
  Hash,
  Database,
  PanelTop,
  PanelBottom,
  Images,
  MessageCircle,
  ClipboardList,
  LogOut,
  Sparkles,
} from "lucide-react";
import type { ElementType } from "../../types";

/**
 * Elementos "singleton" — só podem existir 1 instância por page:
 * - chat-button   → flutuante fixo no canto, 2 ficaria sobreposto
 * - exit-intent   → modal de saída, 2 disparariam simultâneo
 * - section-navbar → cabeçalho único da landing
 * - section-footer → rodapé único da landing
 *
 * Toast user-friendly explica em vez de só rejeitar silenciosamente.
 */
export const SINGLETON_TYPES = new Set<ElementType>([
  "chat-button",
  "exit-intent",
  "section-navbar",
  "section-footer",
  "marketing",
]);

export const SINGLETON_LABELS: Record<string, string> = {
  "chat-button": "Chat IA flutuante",
  "exit-intent": "Exit intent",
  "section-navbar": "Navbar",
  "section-footer": "Footer",
  marketing: "Marketing toolkit",
};

export const ICONS: Record<
  ElementType,
  React.ComponentType<{ className?: string }>
> = {
  text: Type,
  image: ImageIcon,
  svg: Shapes,
  shape: Square,
  divider: Minus,
  icon: StarIcon,
  button: MousePointerClick,
  video: VideoIcon,
  social: Share2,
  spacer: SquareStack,
  "nasa-link": LinkIcon,
  embed: Code2,
  group: SquareStack,
  "section-hero": LayoutTemplate,
  "section-features": LayoutGrid,
  "section-pricing": DollarSign,
  "section-cta": Megaphone,
  "section-stats": BarChart3,
  "section-testimonials": Quote,
  "section-faq": HelpCircle,
  "section-logo-cloud": Building2,
  "section-navbar": PanelTop,
  "section-footer": PanelBottom,
  marquee: MoveHorizontal,
  tabs: Layers,
  accordion: Rows3,
  counter: Hash,
  carousel: Images,
  "chat-button": MessageCircle,
  "embedded-form": ClipboardList,
  "exit-intent": LogOut,
  "data-bound": Database,
  marketing: Sparkles,
};

export const LABELS: Record<ElementType, string> = {
  text: "Texto",
  image: "Imagem",
  svg: "SVG",
  shape: "Forma",
  divider: "Divisor",
  icon: "Ícone",
  button: "Botão",
  video: "Vídeo",
  social: "Social",
  spacer: "Espaço",
  "nasa-link": "Link NASA",
  embed: "Embed",
  group: "Grupo",
  "section-hero": "Hero",
  "section-features": "Features",
  "section-pricing": "Pricing",
  "section-cta": "CTA",
  "section-stats": "Stats",
  "section-testimonials": "Depoimentos",
  "section-faq": "FAQ",
  "section-logo-cloud": "Logos",
  "section-navbar": "Navbar",
  "section-footer": "Footer",
  marquee: "Marquee",
  tabs: "Tabs",
  accordion: "Accordion",
  counter: "Contador",
  carousel: "Carrossel",
  "chat-button": "Chat IA",
  "embedded-form": "Formulário",
  "exit-intent": "Exit intent",
  "data-bound": "Data bound",
  marketing: "Marketing",
};

export const ELEMENT_ORDER: ElementType[] = [
  "text",
  "image",
  "button",
  "shape",
  "divider",
  "icon",
  "video",
  "social",
  "spacer",
  "nasa-link",
  "embed",
  "carousel",
  "chat-button",
  "embedded-form",
  "exit-intent",
  "marketing",
];

// Biblioteca rica de blocos vive em `src/features/pages/lib/block-library.ts`
// (Hero, Depoimentos, Features, Pricing, FAQ, CTA, Navbar, Footer, Stats,
// Logos, Carrosséis). A aba "Blocos" renderiza via `BlocksPanel`.

export type Tab = "elements" | "blocks" | "layers" | "pages" | "page";
