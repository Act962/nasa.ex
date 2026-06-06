/**
 * Helpers do painel de Camadas.
 *
 * - `getElementDisplayName(el)`: nome amigável pra cada linha da lista.
 *   Prioriza heading existente; senão usa o tipo legível com badges
 *   contextuais (ex: "Hero · LIFTBUMBUM…", "Testimonials (3 cards)").
 *
 * - `getElementIcon(type)`: ícone lucide pro indicador visual da linha.
 *   Espelho do `ICONS` do `builder-sidebar.tsx` — duplicado de
 *   propósito pra evitar import cross-component que arrastaria toda a
 *   tab bar pro layers panel.
 *
 * - `flattenGroupsForRender(elements)`: expande filhos de `type:"group"`
 *   pro top-level antes de renderizar no público (LandingFlow), pra
 *   que dedup de singletons e ordering por Y funcione corretamente.
 *   Também filtra `el.hidden`.
 */
import {
  Type, Image as ImageIcon, Square, Minus, MousePointerClick,
  Video as VideoIcon, Share2, Link as LinkIcon, Code2,
  Star as StarIcon, Shapes, SquareStack, LayoutTemplate,
  LayoutGrid, DollarSign, Megaphone, BarChart3,
  Quote, HelpCircle, Building2, MoveHorizontal, Layers,
  Rows3, Hash, Database, Navigation, PanelBottom, Images,
  MessageCircle, ClipboardList, DoorOpen, FolderTree,
} from "lucide-react";
import type { ElementBase, ElementType } from "../types";

/* ─────────────────────────────────────────────────────────────────── */
/*  Display name                                                      */
/* ─────────────────────────────────────────────────────────────────── */

const TYPE_LABELS: Partial<Record<ElementType, string>> = {
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
  "section-pricing": "Preços",
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
  "data-bound": "Dados ao vivo",
};

/** Extrai o texto principal de um TipTap doc (best-effort). */
function tiptapToString(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  if (n.text) return n.text;
  if (Array.isArray(n.content)) return n.content.map(tiptapToString).join(" ");
  return "";
}

/**
 * Pega o label mais "humano" possível pra mostrar na linha da lista.
 * Em ordem de prioridade: heading da section → label do botão → texto
 * extraído do TipTap → tipo padrão.
 */
export function getElementDisplayName(el: ElementBase): string {
  const base = TYPE_LABELS[el.type as ElementType] ?? el.type;

  // Sections com title óbvio
  const title =
    (el.titleLine1 as string | undefined) ??
    (el.title as string | undefined) ??
    (el.heading as string | undefined);
  if (title && title.trim()) {
    const truncated = title.length > 24 ? `${title.slice(0, 24)}…` : title;
    return `${base} · ${truncated}`;
  }

  // Botão tem label
  if (el.type === "button") {
    const label = el.label as string | undefined;
    if (label && label.trim()) return `${base} · ${label}`;
  }

  // Texto solto
  if (el.type === "text") {
    const content = el.content;
    let str = "";
    if (typeof content === "string") str = content;
    else if (content && typeof content === "object") str = tiptapToString(content);
    const trimmed = str.trim();
    if (trimmed) {
      const truncated = trimmed.length > 28 ? `${trimmed.slice(0, 28)}…` : trimmed;
      return `${base} · ${truncated}`;
    }
  }

  // Group com children
  if (el.type === "group") {
    const children = (el.children as ElementBase[] | undefined) ?? [];
    if (children.length > 0) return `Grupo · ${children.length} elementos`;
  }

  return base;
}

/**
 * Badge contextual pra section composta — mostra count de cards/itens
 * pra dar contexto rápido na lista. Retorna string formatada como
 * "(3 cards)" ou null se não aplicável.
 */
export function getElementBadge(el: ElementBase): string | null {
  const cards = el.cards as unknown[] | undefined;
  if (Array.isArray(cards) && cards.length > 0) return `${cards.length} cards`;
  const items = el.items as unknown[] | undefined;
  if (Array.isArray(items) && items.length > 0) return `${items.length} itens`;
  const links = el.links as unknown[] | undefined;
  if (Array.isArray(links) && links.length > 0) return `${links.length} links`;
  const slides = el.slides as unknown[] | undefined;
  if (Array.isArray(slides) && slides.length > 0) return `${slides.length} slides`;
  return null;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Icons                                                             */
/* ─────────────────────────────────────────────────────────────────── */

const TYPE_ICONS: Partial<Record<ElementType, React.ComponentType<{ className?: string }>>> = {
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
  group: FolderTree,
  "section-hero": LayoutTemplate,
  "section-features": LayoutGrid,
  "section-pricing": DollarSign,
  "section-cta": Megaphone,
  "section-stats": BarChart3,
  "section-testimonials": Quote,
  "section-faq": HelpCircle,
  "section-logo-cloud": Building2,
  "section-navbar": Navigation,
  "section-footer": PanelBottom,
  marquee: MoveHorizontal,
  tabs: Layers,
  accordion: Rows3,
  counter: Hash,
  carousel: Images,
  "chat-button": MessageCircle,
  "embedded-form": ClipboardList,
  "exit-intent": DoorOpen,
  "data-bound": Database,
};

export function getElementIcon(
  type: ElementType,
): React.ComponentType<{ className?: string }> {
  return TYPE_ICONS[type] ?? SquareStack;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Flatten groups for public render                                  */
/* ─────────────────────────────────────────────────────────────────── */

/**
 * Pega o array de elements e:
 *   1. Filtra `el.hidden = true` (não renderiza no público).
 *   2. Pra cada `el.type === "group"`, expande seus children como se
 *      fossem top-level. Children herdam visibilidade do pai (se o
 *      grupo está hidden, todos somem juntos — já filtrado em 1).
 *
 * Resultado: array "flat" que respeita visibilidade e permite que o
 * dedup de singletons (chat-button, exit-intent, navbar, footer)
 * enxergue children dos grupos.
 */
export function flattenGroupsForRender(
  elements: ElementBase[],
): ElementBase[] {
  return elements
    .filter((el) => !el.hidden)
    .flatMap((el) => {
      if (el.type === "group") {
        const children = (el.children as ElementBase[] | undefined) ?? [];
        return children.filter((c) => !c.hidden);
      }
      return [el];
    });
}
