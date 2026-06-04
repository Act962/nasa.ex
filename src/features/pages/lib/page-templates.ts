/**
 * Catálogo de templates prontos do NASA Pages.
 *
 * Cada template descreve uma página COMPLETA usando os ElementTypes
 * existentes (sobretudo sections + interativos). User clica num
 * template no wizard de criação e o builder duplica a estrutura
 * pronta — ele só edita textos e cores.
 *
 * Templates são JSON, não componentes. Renderizam pelo mesmo
 * pipeline de elementos.
 */
import { nanoid } from "nanoid";
import type { ElementBase, PageIntent } from "../types";

export interface PageTemplate {
  /** Slug estável — usado no link e analytics. */
  id: string;
  name: string;
  description: string;
  /** Intent default — pode ser override no wizard. */
  intent: PageIntent;
  /** Tag visual no card do template. */
  category: "Sales" | "Eventos" | "Pessoal" | "Comunidade";
  /** Thumbnail URL — placeholder se vazio. */
  thumbnail?: string;
  /** Tokens default da página (cores da marca). */
  tokens: {
    primary: string;
    accent: string;
    bg: string;
    fg: string;
    muted: string;
  };
  /** Elementos pré-posicionados que compõem a página. */
  elements: Array<Omit<ElementBase, "id">>;
}

// Helpers pra encadear sections verticalmente sem repetir Y manual.
let nextY = 0;
function pushAt<T extends Omit<ElementBase, "id">>(
  base: T,
  height = base.h,
): T & { y: number } {
  const out = { ...base, x: 0, y: nextY, h: height };
  nextY += height;
  return out;
}
function resetY() {
  nextY = 0;
}

/**
 * Tema escuro com violeta — usado nos templates "premium".
 */
const DARK_VIOLET_TOKENS = {
  primary: "#7C3AED",
  accent: "#a78bfa",
  bg: "#0f172a",
  fg: "#f8fafc",
  muted: "#94a3b8",
};

const LIGHT_TOKENS = {
  primary: "#7C3AED",
  accent: "#a78bfa",
  bg: "#ffffff",
  fg: "#0f172a",
  muted: "#64748b",
};

/**
 * Template 1 — LANDING INSTITUCIONAL (estilo orbita.nasaex.com light)
 * Composição: Hero → Logo Cloud → Stats → Features → Pricing → FAQ → CTA
 */
function institutionalLanding(): Omit<PageTemplate, "id" | "name" | "description" | "category" | "intent"> {
  resetY();
  return {
    tokens: DARK_VIOLET_TOKENS,
    elements: [
      pushAt({
        type: "section-hero",
        x: 0, y: 0, w: 1200, h: 560,
        badge: "★ Powered pelo Método N.A.S.A.®",
        titleLine1: "O Sistema Operacional",
        titleLine2: "do seu time comercial.",
        subtitle:
          "Comercial, atendimento, financeiro e entrega rodando como um processo só. Sem print no WhatsApp, sem planilha entre setores.",
        primaryCta: "Começar grátis",
        secondaryCta: "Ver demo",
        bgColor: DARK_VIOLET_TOKENS.bg,
        fgColor: DARK_VIOLET_TOKENS.fg,
        primaryColor: DARK_VIOLET_TOKENS.primary,
        mutedColor: DARK_VIOLET_TOKENS.muted,
      }),
      pushAt({
        type: "section-logo-cloud",
        x: 0, y: 0, w: 1200, h: 140,
        heading: "Empresas que confiam na N.A.S.A",
        logos: [
          { id: "1", imageUrl: "", alt: "Marca 1" },
          { id: "2", imageUrl: "", alt: "Marca 2" },
          { id: "3", imageUrl: "", alt: "Marca 3" },
          { id: "4", imageUrl: "", alt: "Marca 4" },
          { id: "5", imageUrl: "", alt: "Marca 5" },
        ],
        bgColor: DARK_VIOLET_TOKENS.bg,
        fgColor: DARK_VIOLET_TOKENS.fg,
        mutedColor: DARK_VIOLET_TOKENS.muted,
      }),
      pushAt({
        type: "section-stats",
        x: 0, y: 0, w: 1200, h: 160,
        stats: [
          { id: "1", value: "2.300+", label: "Empresas ativas" },
          { id: "2", value: "847k+", label: "Contatos organizados" },
          { id: "3", value: "89%", label: "Aumento em conversão" },
          { id: "4", value: "200+", label: "Integrações" },
        ],
        bgColor: DARK_VIOLET_TOKENS.bg,
        fgColor: DARK_VIOLET_TOKENS.fg,
        primaryColor: DARK_VIOLET_TOKENS.primary,
        mutedColor: DARK_VIOLET_TOKENS.muted,
      }),
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 460,
        heading: "Tudo o que sua operação precisa",
        subheading: "Comercial, atendimento, agenda, contrato, financeiro — no mesmo lugar.",
        features: [
          { id: "1", icon: "🎯", title: "Tracking", description: "Funil Kanban com leads que se movem entre setores." },
          { id: "2", icon: "💬", title: "Chat", description: "WhatsApp, Instagram, Telegram juntos." },
          { id: "3", icon: "✨", title: "Astro IA", description: "Inteligência que conhece cada cliente." },
        ],
        bgColor: DARK_VIOLET_TOKENS.bg,
        fgColor: DARK_VIOLET_TOKENS.fg,
        primaryColor: DARK_VIOLET_TOKENS.primary,
        mutedColor: DARK_VIOLET_TOKENS.muted,
      }),
      pushAt({
        type: "section-pricing",
        x: 0, y: 0, w: 1200, h: 560,
        heading: "Planos pra todo time",
        subheading: "Sem cartão pra começar. Cancele quando quiser.",
        plans: [
          { id: "free", name: "Suit", price: "R$ 0", period: "/mês", slogan: "Pra começar.", features: ["1 usuário", "CRM completo", "Suporte por email"], ctaLabel: "Começar grátis" },
          { id: "pro", name: "Earth", price: "R$ 197", period: "/mês", slogan: "Pra equipes pequenas.", features: ["10 usuários", "Todas integrações", "Suporte prioritário"], ctaLabel: "Assinar", highlighted: true, badge: "Mais popular" },
          { id: "ent", name: "Explore", price: "R$ 397", period: "/mês", slogan: "Pra ops complexas.", features: ["Ilimitado", "Gerente dedicado", "SLA"], ctaLabel: "Falar com vendas" },
        ],
        bgColor: DARK_VIOLET_TOKENS.bg,
        fgColor: DARK_VIOLET_TOKENS.fg,
        primaryColor: DARK_VIOLET_TOKENS.primary,
        mutedColor: DARK_VIOLET_TOKENS.muted,
      }),
      pushAt({
        type: "section-faq",
        x: 0, y: 0, w: 1200, h: 460,
        heading: "Perguntas frequentes",
        items: [
          { id: "1", question: "Preciso de cartão pra começar?", answer: "Não. O plano Suit é gratuito pra sempre." },
          { id: "2", question: "Como faço a migração?", answer: "Temos importadores nativos pra RD, Pipedrive e CSV. Acompanhamento na primeira semana incluído." },
          { id: "3", question: "Posso cancelar?", answer: "Sim, em 1 clique. Sem multa, sem retenção." },
        ],
        bgColor: DARK_VIOLET_TOKENS.bg,
        fgColor: DARK_VIOLET_TOKENS.fg,
        primaryColor: DARK_VIOLET_TOKENS.primary,
        mutedColor: DARK_VIOLET_TOKENS.muted,
      }),
      pushAt({
        type: "section-cta",
        x: 0, y: 0, w: 1200, h: 460,
        heading: "Pronto pra decolar?",
        headingAccent: "Vamos juntos.",
        subtitle: "Setup em 5 minutos. Acompanhamento da primeira semana incluído.",
        primaryCta: "Começar grátis",
        secondaryCta: "Ver demo",
        guarantees: ["🛡 LGPD", "🌎 Brasil", "⚡ 5 min"],
        bgColor: DARK_VIOLET_TOKENS.bg,
        fgColor: DARK_VIOLET_TOKENS.fg,
        primaryColor: DARK_VIOLET_TOKENS.primary,
        mutedColor: DARK_VIOLET_TOKENS.muted,
      }),
    ],
  };
}

/**
 * Template 2 — PÁGINA DE CAPTURA SIMPLES
 * Composição: Hero curto + form (placeholder) + CTA
 */
function captureLanding(): Omit<PageTemplate, "id" | "name" | "description" | "category" | "intent"> {
  resetY();
  return {
    tokens: LIGHT_TOKENS,
    elements: [
      pushAt({
        type: "section-hero",
        x: 0, y: 0, w: 1200, h: 440,
        badge: "★ Inscrições abertas",
        titleLine1: "Receba meu material",
        titleLine2: "exclusivo.",
        subtitle: "Cadastre seu email e receba conteúdo prático toda semana.",
        primaryCta: "Quero receber",
        secondaryCta: "Saber mais",
        bgColor: LIGHT_TOKENS.bg,
        fgColor: LIGHT_TOKENS.fg,
        primaryColor: LIGHT_TOKENS.primary,
        mutedColor: LIGHT_TOKENS.muted,
      }),
      pushAt({
        type: "section-testimonials",
        x: 0, y: 0, w: 1200, h: 360,
        heading: "Quem já recebe",
        testimonials: [
          { id: "1", quote: "Material direto ao ponto.", author: "Mariana F." },
          { id: "2", quote: "Aplico no dia a dia.", author: "Rafael L." },
        ],
        bgColor: LIGHT_TOKENS.bg,
        fgColor: LIGHT_TOKENS.fg,
        primaryColor: LIGHT_TOKENS.primary,
        mutedColor: LIGHT_TOKENS.muted,
      }),
      pushAt({
        type: "section-cta",
        x: 0, y: 0, w: 1200, h: 380,
        heading: "Não perca",
        headingAccent: "o próximo email.",
        subtitle: "Cancele quando quiser.",
        primaryCta: "Receber agora",
        secondaryCta: "Talvez depois",
        guarantees: ["Sem spam", "1 email/semana"],
        bgColor: LIGHT_TOKENS.bg,
        fgColor: LIGHT_TOKENS.fg,
        primaryColor: LIGHT_TOKENS.primary,
        mutedColor: LIGHT_TOKENS.muted,
      }),
    ],
  };
}

/**
 * Template 3 — PÁGINA DE EVENTO
 * Composição: Hero + countdown (counter) + features (agenda) + faq + CTA
 */
function eventPage(): Omit<PageTemplate, "id" | "name" | "description" | "category" | "intent"> {
  resetY();
  return {
    tokens: DARK_VIOLET_TOKENS,
    elements: [
      pushAt({
        type: "section-hero",
        x: 0, y: 0, w: 1200, h: 480,
        badge: "📅 13 de Junho · Online",
        titleLine1: "Workshop NASA",
        titleLine2: "vendas com IA.",
        subtitle: "3 horas de prática direta. Vagas limitadas.",
        primaryCta: "Garantir vaga",
        secondaryCta: "Ver agenda",
        bgColor: DARK_VIOLET_TOKENS.bg,
        fgColor: DARK_VIOLET_TOKENS.fg,
        primaryColor: DARK_VIOLET_TOKENS.primary,
        mutedColor: DARK_VIOLET_TOKENS.muted,
      }),
      pushAt({
        type: "counter",
        x: 0, y: 0, w: 1200, h: 160,
        target: 248,
        prefix: "",
        suffix: " inscritos",
        label: "Faltam poucas vagas",
        duration: 1800,
        bgColor: DARK_VIOLET_TOKENS.bg,
        primaryColor: DARK_VIOLET_TOKENS.primary,
        mutedColor: DARK_VIOLET_TOKENS.muted,
      }),
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 440,
        heading: "O que você aprende",
        subheading: "3 módulos práticos.",
        features: [
          { id: "1", icon: "🎯", title: "Captura", description: "Como atrair leads qualificados via Meta + Instagram." },
          { id: "2", icon: "🤖", title: "IA na venda", description: "Automatize follow-up sem perder humanização." },
          { id: "3", icon: "📊", title: "Métricas", description: "Indicadores que importam de verdade." },
        ],
        bgColor: DARK_VIOLET_TOKENS.bg,
        fgColor: DARK_VIOLET_TOKENS.fg,
        primaryColor: DARK_VIOLET_TOKENS.primary,
        mutedColor: DARK_VIOLET_TOKENS.muted,
      }),
      pushAt({
        type: "section-faq",
        x: 0, y: 0, w: 1200, h: 400,
        heading: "Dúvidas comuns",
        items: [
          { id: "1", question: "Tem certificado?", answer: "Sim, com 80% de presença." },
          { id: "2", question: "Vai ficar gravado?", answer: "Sim, disponível por 30 dias após o evento." },
        ],
        bgColor: DARK_VIOLET_TOKENS.bg,
        fgColor: DARK_VIOLET_TOKENS.fg,
        primaryColor: DARK_VIOLET_TOKENS.primary,
        mutedColor: DARK_VIOLET_TOKENS.muted,
      }),
      pushAt({
        type: "section-cta",
        x: 0, y: 0, w: 1200, h: 400,
        heading: "Última chamada",
        headingAccent: "Garante já.",
        subtitle: "Quando lotar, fecha. Sem lista de espera.",
        primaryCta: "Quero minha vaga",
        secondaryCta: "Mais detalhes",
        guarantees: ["3h de prática", "Certificado"],
        bgColor: DARK_VIOLET_TOKENS.bg,
        fgColor: DARK_VIOLET_TOKENS.fg,
        primaryColor: DARK_VIOLET_TOKENS.primary,
        mutedColor: DARK_VIOLET_TOKENS.muted,
      }),
    ],
  };
}

/**
 * Template 4 — PÁGINA DE PRODUTO (Sales letter clássica)
 * Composição: Hero + features + testimonials + pricing + FAQ + CTA
 */
function productPage(): Omit<PageTemplate, "id" | "name" | "description" | "category" | "intent"> {
  resetY();
  return {
    tokens: LIGHT_TOKENS,
    elements: [
      pushAt({
        type: "section-hero",
        x: 0, y: 0, w: 1200, h: 560,
        badge: "★ Lançamento",
        titleLine1: "Conheça o produto",
        titleLine2: "que muda tudo.",
        subtitle: "Uma frase que vende o desejo sem prometer demais.",
        primaryCta: "Comprar agora",
        secondaryCta: "Conhecer",
        bgColor: LIGHT_TOKENS.bg,
        fgColor: LIGHT_TOKENS.fg,
        primaryColor: LIGHT_TOKENS.primary,
        mutedColor: LIGHT_TOKENS.muted,
      }),
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 460,
        heading: "Por que você vai gostar",
        subheading: "Recursos pensados pra você.",
        features: [
          { id: "1", icon: "⚡", title: "Rápido", description: "Setup em minutos." },
          { id: "2", icon: "🎯", title: "Preciso", description: "Resultado real e mensurável." },
          { id: "3", icon: "🛡", title: "Garantia", description: "7 dias pra devolver, sem perguntas." },
        ],
        bgColor: LIGHT_TOKENS.bg,
        fgColor: LIGHT_TOKENS.fg,
        primaryColor: LIGHT_TOKENS.primary,
        mutedColor: LIGHT_TOKENS.muted,
      }),
      pushAt({
        type: "section-testimonials",
        x: 0, y: 0, w: 1200, h: 380,
        heading: "Quem usa, recomenda",
        testimonials: [
          { id: "1", quote: "Mudou meu dia a dia.", author: "Mariana F.", role: "Cliente desde 2024" },
          { id: "2", quote: "Vale cada centavo.", author: "Rafael L.", role: "Cliente desde 2025" },
        ],
        bgColor: LIGHT_TOKENS.bg,
        fgColor: LIGHT_TOKENS.fg,
        primaryColor: LIGHT_TOKENS.primary,
        mutedColor: LIGHT_TOKENS.muted,
      }),
      pushAt({
        type: "section-cta",
        x: 0, y: 0, w: 1200, h: 400,
        heading: "Não vai querer ficar",
        headingAccent: "de fora.",
        subtitle: "Garantia incondicional de 7 dias.",
        primaryCta: "Comprar agora",
        secondaryCta: "Falar antes",
        guarantees: ["🛡 Garantia 7 dias", "💳 Cartão ou PIX"],
        bgColor: LIGHT_TOKENS.bg,
        fgColor: LIGHT_TOKENS.fg,
        primaryColor: LIGHT_TOKENS.primary,
        mutedColor: LIGHT_TOKENS.muted,
      }),
    ],
  };
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "institutional-landing",
    name: "Landing Institucional",
    description: "Página de venda completa estilo SaaS, com hero, planos e FAQ. Ideal pra produtos B2B.",
    intent: "INSTITUTIONAL",
    category: "Sales",
    ...institutionalLanding(),
  },
  {
    id: "capture-landing",
    name: "Página de Captura",
    description: "Foco em coletar email/contato, com prova social mínima.",
    intent: "LANDING",
    category: "Sales",
    ...captureLanding(),
  },
  {
    id: "event-page",
    name: "Página de Evento",
    description: "Hero + countdown + agenda + dúvidas + inscrição. Pra workshops, webinars, lives.",
    intent: "EVENT",
    category: "Eventos",
    ...eventPage(),
  },
  {
    id: "product-page",
    name: "Página de Produto",
    description: "Sales letter clássica: hero, benefícios, depoimentos, oferta.",
    intent: "PRODUCT",
    category: "Sales",
    ...productPage(),
  },
];

/**
 * Aplica um template — gera elementos com IDs novos prontos pra
 * inserir no banco. Chamado pelo wizard de criação.
 */
export function applyTemplate(
  templateId: string,
): { elements: ElementBase[]; tokens: PageTemplate["tokens"] } | null {
  const template = PAGE_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return null;
  const elements = template.elements.map((el) => ({
    ...el,
    id: `el_${nanoid(10)}`,
  })) as ElementBase[];
  return { elements, tokens: template.tokens };
}
