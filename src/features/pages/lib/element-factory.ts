import { nanoid } from "nanoid";
import type { ElementBase, ElementType } from "../types";

const DEFAULTS: Record<ElementType, (palette: Record<string, string>) => Omit<ElementBase, "id">> = {
  text: (p) => ({
    type: "text",
    x: 40, y: 40, w: 360, h: 80,
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Texto" }] }] },
    color: p.fg ?? "#0f172a",
    fontSize: 24,
    fontFamily: "Inter",
    align: "left",
  }),
  image: () => ({
    type: "image",
    x: 40, y: 40, w: 320, h: 200,
    src: "",
    alt: "",
    fit: "cover",
    borderRadius: 8,
  }),
  svg: () => ({
    type: "svg",
    x: 40, y: 40, w: 160, h: 160,
    src: "",
    colorOverrides: {},
  }),
  shape: (p) => ({
    type: "shape",
    x: 40, y: 40, w: 200, h: 200,
    shape: "rect",
    fill: p.primary ?? "#6366f1",
    borderRadius: 12,
  }),
  divider: (p) => ({
    type: "divider",
    x: 40, y: 40, w: 400, h: 2,
    orientation: "horizontal",
    color: p.muted ?? "#94a3b8",
    thickness: 2,
  }),
  icon: (p) => ({
    type: "icon",
    x: 40, y: 40, w: 48, h: 48,
    name: "Star",
    color: p.primary ?? "#6366f1",
    strokeWidth: 2,
  }),
  button: (p) => ({
    type: "button",
    x: 40, y: 40, w: 180, h: 48,
    label: "Clique aqui",
    variant: "solid",
    radius: 10,
    bg: p.primary ?? "#6366f1",
    fg: "#ffffff",
  }),
  video: () => ({
    type: "video",
    x: 40, y: 40, w: 560, h: 315,
    provider: "yt",
    url: "",
    autoplay: false,
    muted: true,
    loop: false,
  }),
  social: (p) => ({
    type: "social",
    x: 40, y: 40, w: 240, h: 48,
    platforms: ["instagram", "facebook", "linkedin"],
    iconColor: p.fg ?? "#0f172a",
    size: 32,
    gap: 12,
  }),
  spacer: () => ({
    type: "spacer",
    x: 0, y: 0, w: 600, h: 80,
  }),
  "nasa-link": (p) => ({
    type: "nasa-link",
    x: 40, y: 40, w: 320, h: 100,
    appId: "tracking",
    label: "Acompanhar pipeline",
    variant: "card",
    bg: p.bg ?? "#ffffff",
    fg: p.fg ?? "#0f172a",
  }),
  embed: () => ({
    type: "embed",
    x: 40, y: 40, w: 400, h: 300,
    html: "",
  }),
  group: () => ({
    type: "group",
    x: 40, y: 40, w: 400, h: 200,
    children: [] as ElementBase[],
  }),

  // ── Sections completas (Fase 1) ──────────────────────────────
  // Dimensões grandes (full-width canvas) — sections sempre ocupam
  // a largura disponível e altura conforme conteúdo. O builder pode
  // permitir resize, mas o default já cabe em qualquer artboard.

  "section-hero": (p) => ({
    type: "section-hero",
    x: 0, y: 0, w: 1200, h: 560,
    badge: "★ Novidade",
    titleLine1: "Sua headline poderosa",
    titleLine2: "começa aqui.",
    subtitle:
      "Uma frase clara que explica o que sua empresa faz e por que importa.",
    primaryCta: "Começar agora",
    secondaryCta: "Ver demo",
    imageUrl: "",
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    primaryColor: p.primary ?? "#7C3AED",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  "section-features": (p) => ({
    type: "section-features",
    x: 0, y: 0, w: 1200, h: 480,
    heading: "Por que escolher a gente",
    subheading: "Três motivos concretos antes de você testar.",
    features: [
      { id: "1", icon: "⚡", title: "Rápido", description: "Setup em minutos." },
      { id: "2", icon: "🛡", title: "Seguro", description: "LGPD compliant." },
      { id: "3", icon: "🚀", title: "Escalável", description: "Sem limite artificial." },
    ],
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    primaryColor: p.primary ?? "#7C3AED",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  "section-pricing": (p) => ({
    type: "section-pricing",
    x: 0, y: 0, w: 1200, h: 560,
    heading: "Planos pra todo time",
    subheading: "Sem cartão pra começar.",
    plans: [
      {
        id: "free",
        name: "Free",
        price: "R$ 0",
        period: "/mês",
        slogan: "Pra começar.",
        features: ["1 usuário", "Recursos básicos"],
        ctaLabel: "Começar grátis",
      },
      {
        id: "pro",
        name: "Pro",
        price: "R$ 197",
        period: "/mês",
        slogan: "Pra equipes pequenas.",
        features: ["10 usuários", "Integrações", "Suporte"],
        ctaLabel: "Assinar",
        highlighted: true,
        badge: "Mais popular",
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: "Sob consulta",
        slogan: "Pra grandes operações.",
        features: ["Ilimitado", "Gerente dedicado", "SLA"],
        ctaLabel: "Falar com vendas",
      },
    ],
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    primaryColor: p.primary ?? "#7C3AED",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  "section-cta": (p) => ({
    type: "section-cta",
    x: 0, y: 0, w: 1200, h: 480,
    heading: "Pronto pra começar?",
    headingAccent: "Vamos decolar.",
    subtitle: "Sem cartão, sem contrato. Cancele quando quiser.",
    primaryCta: "Começar agora",
    secondaryCta: "Falar com vendas",
    guarantees: ["🛡 LGPD", "🌎 Brasil", "⚡ 5 min"],
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    primaryColor: p.primary ?? "#7C3AED",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  "section-stats": (p) => ({
    type: "section-stats",
    x: 0, y: 0, w: 1200, h: 160,
    stats: [
      { id: "1", value: "2.3k+", label: "Clientes" },
      { id: "2", value: "98%", label: "Satisfação" },
      { id: "3", value: "24/7", label: "Suporte" },
      { id: "4", value: "5 min", label: "Setup" },
    ],
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    primaryColor: p.primary ?? "#7C3AED",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  "section-testimonials": (p) => ({
    type: "section-testimonials",
    x: 0, y: 0, w: 1200, h: 400,
    heading: "O que dizem",
    testimonials: [
      {
        id: "1",
        quote: "Mudou minha rotina completamente.",
        author: "Mariana F.",
        role: "Designer",
        avatar: "https://i.pravatar.cc/120?img=5",
      },
      {
        id: "2",
        quote: "Saí de 7 ferramentas pra uma.",
        author: "Rafael Lima",
        role: "Consultor",
        avatar: "https://i.pravatar.cc/120?img=11",
      },
      {
        id: "3",
        quote: "Game changer.",
        author: "Ana Carvalho",
        role: "Corretora",
        avatar: "https://i.pravatar.cc/120?img=20",
      },
    ],
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    primaryColor: p.primary ?? "#7C3AED",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  "section-faq": (p) => ({
    type: "section-faq",
    x: 0, y: 0, w: 1200, h: 480,
    heading: "Perguntas frequentes",
    items: [
      {
        id: "1",
        question: "Preciso de cartão pra começar?",
        answer: "Não. Plano Free gratuito pra sempre.",
      },
      {
        id: "2",
        question: "Como migro meus dados?",
        answer: "Importadores nativos pra RD, Pipedrive, CSV.",
      },
      {
        id: "3",
        question: "Posso cancelar?",
        answer: "Sim, em 1 clique, sem multa.",
      },
    ],
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    primaryColor: p.primary ?? "#7C3AED",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  "section-logo-cloud": (p) => ({
    type: "section-logo-cloud",
    x: 0, y: 0, w: 1200, h: 160,
    heading: "Empresas que confiam em nós",
    logos: [
      { id: "1", imageUrl: "", alt: "Marca 1" },
      { id: "2", imageUrl: "", alt: "Marca 2" },
      { id: "3", imageUrl: "", alt: "Marca 3" },
      { id: "4", imageUrl: "", alt: "Marca 4" },
      { id: "5", imageUrl: "", alt: "Marca 5" },
    ],
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  "section-navbar": (p) => ({
    type: "section-navbar",
    x: 0, y: 0, w: 1200, h: 80,
    logoSrc: "",
    logoText: "N.A.S.A",
    links: [
      { id: "1", label: "Planos", href: "#planos" },
      { id: "2", label: "O que é NASA?", href: "#o-que-e-nasa" },
      { id: "3", label: "Como funciona", href: "#como-funciona" },
    ],
    primaryCta: "Começar grátis",
    secondaryCta: "Entrar",
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    primaryColor: p.primary ?? "#7C3AED",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  "section-footer": (p) => ({
    type: "section-footer",
    x: 0, y: 0, w: 1200, h: 140,
    logoSrc: "",
    logoText: "N.A.S.A",
    tagline: "Powered pelo Método N.A.S.A.®",
    copyright: "© 2026 N.A.S.A",
    links: [
      { id: "1", label: "Políticas de Privacidade", href: "#" },
      { id: "2", label: "Termos & Condições", href: "#" },
    ],
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  // ── Blocos interativos (Fase 2) ──────────────────────────────

  marquee: (p) => ({
    type: "marquee",
    x: 0, y: 0, w: 1200, h: 80,
    items: [
      { id: "1", label: "Item 1" },
      { id: "2", label: "Item 2" },
      { id: "3", label: "Item 3" },
      { id: "4", label: "Item 4" },
      { id: "5", label: "Item 5" },
    ],
    speed: 35,
    gap: 48,
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
  }),

  tabs: (p) => ({
    type: "tabs",
    x: 0, y: 0, w: 600, h: 300,
    tabs: [
      { id: "1", label: "Aba 1", content: "Conteúdo da primeira aba." },
      { id: "2", label: "Aba 2", content: "Conteúdo da segunda aba." },
      { id: "3", label: "Aba 3", content: "Conteúdo da terceira aba." },
    ],
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    primaryColor: p.primary ?? "#7C3AED",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  accordion: (p) => ({
    type: "accordion",
    x: 0, y: 0, w: 600, h: 300,
    items: [
      { id: "1", title: "Item 1", content: "Detalhes do item 1." },
      { id: "2", title: "Item 2", content: "Detalhes do item 2." },
      { id: "3", title: "Item 3", content: "Detalhes do item 3." },
    ],
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    primaryColor: p.primary ?? "#7C3AED",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  counter: (p) => ({
    type: "counter",
    x: 0, y: 0, w: 240, h: 160,
    target: 1000,
    prefix: "",
    suffix: "+",
    label: "Total",
    duration: 1800,
    bgColor: p.bg ?? "#0f172a",
    primaryColor: p.primary ?? "#7C3AED",
    mutedColor: p.muted ?? "#94a3b8",
  }),

  // ── Data binding (Fase 5) ────────────────────────────────────

  "data-bound": (p) => ({
    type: "data-bound",
    x: 0, y: 0, w: 600, h: 300,
    binding: {
      source: "plans-list",
      limit: 4,
      layout: "grid",
    },
    bgColor: p.bg ?? "#0f172a",
    fgColor: p.fg ?? "#f8fafc",
    primaryColor: p.primary ?? "#7C3AED",
    mutedColor: p.muted ?? "#94a3b8",
  }),
};

export function createElement(
  type: ElementType,
  palette: Record<string, string> = {},
): ElementBase {
  const defaults = DEFAULTS[type](palette);
  return {
    id: `el_${nanoid(10)}`,
    ...defaults,
  } as ElementBase;
}
