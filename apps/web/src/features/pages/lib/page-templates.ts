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
  height: number = base.h as number,
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

/**
 * Template 5 — RÉPLICA da landing orbita.nasaex.com (PR #82)
 *
 * Reproduz a narrativa "OS do processo" usando os blocos novos do
 * NASA Pages. Não consegue 100% de fidelidade (a landing original tem
 * componentes React custom como SVG de foguete + grid agrupado de
 * apps + mock do Space Point) — usa os blocos mais próximos pra
 * cobrir a estrutura. Bom como **SHOWCASE** dos ElementTypes novos:
 * cobre hero, stats, marquee, features (3 instâncias com narrativas
 * diferentes), cta (3 instâncias), pricing, testimonials, faq,
 * data-bound.
 *
 * 13 blocos, cobre 10 ElementTypes diferentes.
 */
function nasaOrbitaLanding(): Omit<PageTemplate, "id" | "name" | "description" | "category" | "intent"> {
  resetY();
  const T = DARK_VIOLET_TOKENS;
  return {
    tokens: T,
    elements: [
      // ── 0. NAVBAR (sticky topo) ──
      pushAt({
        type: "section-navbar",
        x: 0, y: 0, w: 1200, h: 80,
        logoText: "N.A.S.A",
        logoSrc: "",  // ← Edita aqui pra trocar pela URL da sua logo
        logoHref: "#top",
        links: [
          { id: "1", label: "Planos", href: "#planos" },
          { id: "2", label: "O que é NASA?", href: "#o-que-e-nasa" },
          { id: "3", label: "Como funciona", href: "#como-funciona" },
        ],
        primaryCta: "Começar grátis",
        primaryCtaHref: "#cta-final",  // ← scroll pro CTA final
        secondaryCta: "Entrar",
        secondaryCtaHref: "/sign-in",
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 1. HERO — Sistema Operacional do processo ──
      pushAt({
        type: "section-hero",
        x: 0, y: 0, w: 1200, h: 560,
        badge: "★ Powered pelo Método N.A.S.A.®",
        titleLine1: "Seu processo não devia morrer",
        titleLine2: "toda vez que muda de setor.",
        subtitle:
          "Comercial, atendimento, financeiro e entrega rodando como um processo só. Sem print no WhatsApp, sem planilha entre setores. O sistema leva o trabalho de um setor pro outro sozinho.",
        primaryCta: "Ver funcionando",
        secondaryCta: "Começar de graça",
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 2. STATS — social proof ──
      pushAt({
        type: "section-stats",
        x: 0, y: 0, w: 1200, h: 160,
        stats: [
          { id: "1", value: "2.300+", label: "Empresas ativas" },
          { id: "2", value: "847k+", label: "Contatos organizados" },
          { id: "3", value: "89%", label: "Aumento em conversão" },
          { id: "4", value: "200+", label: "Integrações" },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 3. MARQUEE — logos de parceiros ──
      pushAt({
        type: "marquee",
        x: 0, y: 0, w: 1200, h: 100,
        items: [
          { id: "1", label: "Empresas que confiam na N.A.S.A" },
          { id: "2", label: "Parceiro 1" },
          { id: "3", label: "Parceiro 2" },
          { id: "4", label: "Parceiro 3" },
          { id: "5", label: "Parceiro 4" },
          { id: "6", label: "Parceiro 5" },
        ],
        speed: 25, gap: 64,
        bgColor: T.bg, fgColor: T.fg,
      }),

      // ── 4. FEATURES — Método N.A.S.A.® (4 etapas) ──
      // Âncora #o-que-e-nasa configurada pra linkar pela navbar.
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 460,
        anchorId: "o-que-e-nasa",
        heading: "O Método N.A.S.A.® — do primeiro contato à entrega",
        subheading: "4 estágios que organizam o processo inteiro, não só a venda.",
        features: [
          { id: "1", icon: "🛰", title: "Necessidade", description: "Preparação. Recebe contatos de qualquer canal num lugar só." },
          { id: "2", icon: "🔥", title: "Análise", description: "Ignição. Entende quem está pronto pra comprar." },
          { id: "3", icon: "🚀", title: "Sistematização", description: "Propulsão. Automações empurram o cliente entre etapas." },
          { id: "4", icon: "🌍", title: "Ação", description: "Em órbita. Proposta assinada, entrega feita, ciclo girando." },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 5. FEATURES — Automação (5 estágios fluindo) ──
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 460,
        heading: "Um processo que anda sozinho, do começo ao fim.",
        subheading: "O sistema leva o trabalho de um setor pro outro. Sem ninguém esquecendo.",
        features: [
          { id: "1", icon: "📥", title: "Chega", description: "Cliente entra por WhatsApp, Instagram, formulário ou anúncio." },
          { id: "2", icon: "💬", title: "Avança", description: "Mensagem certa sai na hora certa, sem ninguém lembrar." },
          { id: "3", icon: "📄", title: "Fecha", description: "Proposta assinada → atendimento recebe com histórico." },
          { id: "4", icon: "💳", title: "Cobra", description: "Payment gera cobrança e dá baixa sozinho." },
          { id: "5", icon: "📦", title: "Entrega", description: "NASA Route libera, atendimento segue com tudo." },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 6. FEATURES — Apps NASA (destaques dos 14 módulos) ──
      // Âncora #como-funciona configurada pra linkar pela navbar.
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 460,
        anchorId: "como-funciona",
        heading: "Uma plataforma. O processo inteiro, na ordem certa.",
        subheading: "Cada ferramenta é um passo do mesmo processo, não um app solto.",
        features: [
          { id: "1", icon: "📊", title: "Tracking", description: "Caminho do cliente em Kanban com as etapas que vocês usam." },
          { id: "2", icon: "✨", title: "Astro IA", description: "IA que conhece cada cliente em qualquer etapa." },
          { id: "3", icon: "🔥", title: "Forge", description: "Propostas, contratos com assinatura, link público." },
          { id: "4", icon: "💳", title: "Payment", description: "Cobrança multi-gateway com baixa automática." },
          { id: "5", icon: "🛰", title: "NASA Route", description: "Cursos, trilhas, comunidade pós-venda." },
          { id: "6", icon: "📈", title: "Insights", description: "Onde o processo trava e quanto cada etapa custa." },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 7. CTA — Astro ──
      pushAt({
        type: "section-cta",
        x: 0, y: 0, w: 1200, h: 380,
        heading: "Conheça o Astro.",
        headingAccent: "IA que responde pelo seu time.",
        subtitle: "Conhece o histórico de cada cliente em qualquer etapa e responde mesmo quando você está dormindo.",
        primaryCta: "Testar o Astro",
        secondaryCta: "Ver demo",
        guarantees: ["🧠 Claude + Gemini + GPT", "🇧🇷 Português nativo"],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 8. MARQUEE — integrações ──
      pushAt({
        type: "marquee",
        x: 0, y: 0, w: 1200, h: 80,
        items: [
          { id: "1", label: "WhatsApp Business" },
          { id: "2", label: "Instagram DM" },
          { id: "3", label: "Telegram" },
          { id: "4", label: "Meta Ads" },
          { id: "5", label: "Google Ads" },
          { id: "6", label: "Stripe" },
          { id: "7", label: "Asaas" },
          { id: "8", label: "RD Station" },
          { id: "9", label: "Pipedrive" },
          { id: "10", label: "TikTok Ads" },
        ],
        speed: 35, gap: 48,
        bgColor: T.bg, fgColor: T.fg,
      }),

      // ── 9. DATA-BOUND — leaderboard real do Space Points ──
      pushAt({
        type: "data-bound",
        x: 0, y: 0, w: 1200, h: 360,
        binding: {
          source: "space-points-leaderboard",
          layout: "list",
          limit: 5,
        },
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 10. PRICING — planos da NASA ──
      // Âncora #planos configurada pra linkar pela navbar.
      pushAt({
        type: "section-pricing",
        x: 0, y: 0, w: 1200, h: 560,
        anchorId: "planos",
        heading: "Planos pra todo time",
        subheading: "Sem cartão pra começar. Cancele quando quiser.",
        plans: [
          { id: "free", name: "Suit", price: "R$ 0", period: "/mês", slogan: "Pra tirar o processo do WhatsApp.", features: ["1 usuário", "CRM completo", "Suporte email"], ctaLabel: "Começar grátis" },
          { id: "earth", name: "Earth", price: "R$ 197", period: "/mês", slogan: "Pra comercial e atendimento conversando.", features: ["~5 usuários", "1.000★/mês", "Suporte prioritário"], ctaLabel: "Assinar Earth", highlighted: true, badge: "Mais popular" },
          { id: "explore", name: "Explore", price: "R$ 397", period: "/mês", slogan: "Pra processo entre vários setores.", features: ["~15 usuários", "3.000★/mês", "Astro completo"], ctaLabel: "Assinar Explore" },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 11. TESTIMONIALS ──
      pushAt({
        type: "section-testimonials",
        x: 0, y: 0, w: 1200, h: 380,
        heading: "Quem usa, vê diferença.",
        testimonials: [
          { id: "1", quote: "Saí de 7 ferramentas pra uma. Time inteiro agradeceu.", author: "Rafael Lima", role: "Lima Consultoria", avatar: "https://i.pravatar.cc/120?img=11" },
          { id: "2", quote: "Em 2 meses, dobrei minha conversão.", author: "Mariana F.", role: "Studio MF Design", avatar: "https://i.pravatar.cc/120?img=5" },
          { id: "3", quote: "A IA conhece cada cliente. Game changer.", author: "Ana Carvalho", role: "AC Imóveis", avatar: "https://i.pravatar.cc/120?img=20" },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 12. FAQ ──
      pushAt({
        type: "section-faq",
        x: 0, y: 0, w: 1200, h: 460,
        heading: "Perguntas frequentes",
        items: [
          { id: "1", question: "Preciso de cartão pra começar?", answer: "Não. O plano Suit é gratuito pra sempre." },
          { id: "2", question: "Como faço a migração?", answer: "Importadores nativos pra RD, Pipedrive, CSV. Acompanhamento na primeira semana incluído." },
          { id: "3", question: "Posso cancelar a qualquer momento?", answer: "Sim, em 1 clique. Sem multa, sem retenção." },
          { id: "4", question: "Vou precisar de dev?", answer: "Não pra começar. Setup completo em ~5 minutos." },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 13. CTA FINAL ──
      // Âncora #cta-final — destino do CTA primário da navbar.
      pushAt({
        type: "section-cta",
        x: 0, y: 0, w: 1200, h: 460,
        anchorId: "cta-final",
        heading: "O processo que mais te dói",
        headingAccent: "pode estar em órbita até sexta-feira.",
        subtitle: "Sem cartão. Sem trocar tudo às cegas. A gente monta o lançamento com você.",
        primaryCta: "Começar meu primeiro processo",
        primaryCtaHref: "/sign-up",
        secondaryCta: "Ver demo ao vivo",
        secondaryCtaHref: "#",
        guarantees: ["🛡 LGPD", "🌎 Brasil", "⚡ 5 min", "📞 1ª semana acompanhada"],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 14. FOOTER ──
      pushAt({
        type: "section-footer",
        x: 0, y: 0, w: 1200, h: 140,
        logoText: "N.A.S.A",
        tagline: "Powered pelo Método N.A.S.A.®",
        copyright: "© 2026 N.A.S.A",
        links: [
          { id: "1", label: "Políticas de Privacidade", href: "#" },
          { id: "2", label: "Termos & Condições", href: "#" },
        ],
        bgColor: T.bg, fgColor: T.fg, mutedColor: T.muted,
      }),
    ],
  };
}

/**
 * Template — A MINA (réplica da landing leonardoloureiro.com.br/a-mina/)
 *
 * Página de venda de imersão presencial de 3 dias com tema dourado
 * (#CEB15D) sobre empreendedorismo + propósito + família. Usa todos
 * os blocos novos pra reproduzir a estrutura:
 *
 * Navbar → Hero → Stats → Logo Cloud (mídia) → Features (4 pilares:
 * crescer sem perder família, autocontrole, finanças, equilíbrio) →
 * Features (3 níveis de ingresso) → Pricing (ingressos) → CTA mid →
 * Testimonials → FAQ → CTA final → Footer.
 *
 * 14 blocos, mostra paleta customizada (dourado em fundo escuro).
 */
function aMinaImersao(): Omit<PageTemplate, "id" | "name" | "description" | "category" | "intent"> {
  resetY();
  // Tokens dourados — paleta da landing original
  const T = {
    primary: "#CEB15D",
    accent: "#f59e0b",
    bg: "#0a0a0a",
    fg: "#f8fafc",
    muted: "#9ca3af",
  };
  return {
    tokens: T,
    elements: [
      // ── 0. NAVBAR ──
      pushAt({
        type: "section-navbar",
        x: 0, y: 0, w: 1200, h: 80,
        logoText: "A MINA",
        links: [
          { id: "1", label: "Sobre", href: "#sobre" },
          { id: "2", label: "O que você aprende", href: "#aprender" },
          { id: "3", label: "Ingressos", href: "#ingressos" },
          { id: "4", label: "Depoimentos", href: "#depoimentos" },
        ],
        primaryCta: "Garantir vaga",
        secondaryCta: "Saber mais",
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 1. HERO ──
      pushAt({
        type: "section-hero",
        x: 0, y: 0, w: 1200, h: 600,
        badge: "⛏ Imersão presencial · 3 dias",
        titleLine1: "Você tem uma MINA de ouro",
        titleLine2: "dentro de você.",
        subtitle:
          "Eu vou te ajudar a tratar seu CPF, minerar o ouro que está aí dentro de você e construir um CNPJ de sucesso pra você vivenciar sua próxima década de ouro.",
        primaryCta: "GARANTA O SEU INGRESSO",
        secondaryCta: "Conhecer o método",
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 2. STATS ──
      pushAt({
        type: "section-stats",
        x: 0, y: 0, w: 1200, h: 180,
        stats: [
          { id: "1", value: "3 dias", label: "De imersão presencial" },
          { id: "2", value: "+1.000", label: "Alunos transformados" },
          { id: "3", value: "6 a 9", label: "Dígitos faturamento dos alunos" },
          { id: "4", value: "100%", label: "Foco em propósito + lucro" },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 3. LOGO CLOUD (mídia) ──
      pushAt({
        type: "section-logo-cloud",
        x: 0, y: 0, w: 1200, h: 140,
        heading: "Leonardo Loureiro na mídia",
        logos: [
          { id: "1", imageUrl: "", alt: "Globo" },
          { id: "2", imageUrl: "", alt: "Record TV" },
          { id: "3", imageUrl: "", alt: "SBT" },
          { id: "4", imageUrl: "", alt: "Band" },
          { id: "5", imageUrl: "", alt: "EXAME" },
        ],
        bgColor: T.bg, fgColor: T.fg, mutedColor: T.muted,
      }),

      // ── 4. FEATURES — Os 4 pilares ──
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 500,
        heading: "Os 4 pilares da década de ouro",
        subheading:
          "Sua vida é tal qual o Burj Khalifa: precisa de fundação sólida pra escalar sem desabar.",
        features: [
          { id: "1", icon: "👨‍👩‍👧", title: "Família primeiro", description: "Crescer seu negócio sem perder sua família. Propósito antes de faturamento." },
          { id: "2", icon: "🧠", title: "Autocontrole emocional", description: "Gestão de equipe, liderança e clareza mental pra decisões difíceis." },
          { id: "3", icon: "💰", title: "Finanças saudáveis", description: "Gerir melhor suas finanças pessoais e empresariais. CPF forte, CNPJ forte." },
          { id: "4", icon: "⚖", title: "Equilíbrio total", description: "Vida pessoal e profissional fluindo juntas, sem culpa nem esgotamento." },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 5. FEATURES — O que você aprende ──
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 500,
        heading: "O que você vai aprender em 3 dias",
        subheading:
          "Conteúdo prático, aplicável no Monday-morning, com o método que já transformou +1.000 empresários.",
        features: [
          { id: "1", icon: "📈", title: "Aumentar resultados", description: "Estratégias pra escalar faturamento com inteligência, não com sacrifício." },
          { id: "2", icon: "🎯", title: "Definir metas claras", description: "Metas pessoais e profissionais com clareza, sem confundir números com propósito." },
          { id: "3", icon: "👥", title: "Liderar equipes", description: "Técnicas pra liderar melhor, construir cultura forte e atrair talento certo." },
          { id: "4", icon: "🔥", title: "Encontrar o propósito", description: "Descobrir o porquê do seu negócio existir além do dinheiro." },
          { id: "5", icon: "🛡", title: "Proteger sua família", description: "Manter laços fortes mesmo crescendo profissionalmente." },
          { id: "6", icon: "🏗", title: "Construir fundação", description: "Bases sólidas pro CNPJ aguentar a próxima década de crescimento." },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 6. CTA mid-page ──
      pushAt({
        type: "section-cta",
        x: 0, y: 0, w: 1200, h: 400,
        heading: "Você não nasceu pra mediocridade.",
        headingAccent: "Encontre seu lugar de paz.",
        subtitle: "3 dias presenciais que podem mudar sua próxima década inteira.",
        primaryCta: "QUERO MEU INGRESSO",
        secondaryCta: "Falar com consultor",
        guarantees: ["⛏ 3 dias presenciais", "🍽 Coffee + almoço", "📜 Certificado", "🎁 Kit do Aluno"],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 7. PRICING — Ingressos ──
      pushAt({
        type: "section-pricing",
        x: 0, y: 0, w: 1200, h: 620,
        heading: "Escolha seu ingresso",
        subheading: "Vagas limitadas. Lote promocional encerra em breve.",
        plans: [
          {
            id: "basic",
            name: "Ingresso Padrão",
            price: "R$ 1.497",
            period: "à vista",
            slogan: "Acesso completo aos 3 dias.",
            features: [
              "Acesso aos 3 dias de evento",
              "Material completo",
              "Coffee break",
              "Certificado de participação",
            ],
            ctaLabel: "Garantir Padrão",
          },
          {
            id: "vip",
            name: "Espaço VIP",
            price: "R$ 2.997",
            period: "à vista",
            slogan: "Tudo do Padrão + acesso preferencial.",
            features: [
              "Tudo do Padrão",
              "Lugar reservado nas primeiras filas",
              "Almoço incluso (3 dias)",
              "Mesão de apoio exclusivo",
              "Kit do Aluno premium",
              "Coffee e bebidas premium",
            ],
            ctaLabel: "QUERO O VIP",
            highlighted: true,
            badge: "Mais escolhido",
          },
          {
            id: "vip-plus",
            name: "VIP + Mentoria",
            price: "R$ 5.997",
            period: "à vista",
            slogan: "Tudo do VIP + 1h de mentoria 1:1.",
            features: [
              "Tudo do VIP",
              "1h de mentoria individual com Leonardo",
              "Acesso ao grupo de alunos por 6 meses",
              "Diagnóstico personalizado do CPF/CNPJ",
              "Acesso vitalício às gravações",
            ],
            ctaLabel: "Falar com vendas",
          },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 8. TESTIMONIALS ──
      pushAt({
        type: "section-testimonials",
        x: 0, y: 0, w: 1200, h: 420,
        heading: "Depoimentos de quem viveu A MINA",
        testimonials: [
          {
            id: "1",
            quote: "Saí do evento com a clareza que eu precisava há 5 anos. Mudei minha empresa em 6 meses.",
            author: "João Picoli",
            role: "Empresário",
            avatar: "https://i.pravatar.cc/120?img=33",
          },
          {
            id: "2",
            quote: "O Leonardo não vende método. Ele te entrega uma vida.",
            author: "Carla Mendes",
            role: "CEO Construtora",
            avatar: "https://i.pravatar.cc/120?img=44",
          },
          {
            id: "3",
            quote: "Achei meu propósito em 3 dias. Faturamento dobrou no semestre seguinte.",
            author: "Marcus Vinícius",
            role: "Founder Tech",
            avatar: "https://i.pravatar.cc/120?img=51",
          },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 9. FAQ ──
      pushAt({
        type: "section-faq",
        x: 0, y: 0, w: 1200, h: 460,
        heading: "Dúvidas comuns",
        items: [
          {
            id: "1",
            question: "Onde acontece a imersão?",
            answer:
              "Em local premium no Rio de Janeiro. O endereço completo é enviado aos inscritos 15 dias antes do evento.",
          },
          {
            id: "2",
            question: "E se eu não puder ir num dos dias?",
            answer:
              "O conteúdo é progressivo, mas se faltar 1 dia você pode acompanhar pela gravação no portal de alunos (somente VIP+).",
          },
          {
            id: "3",
            question: "Posso parcelar?",
            answer:
              "Sim. Aceitamos cartão de crédito em até 12x, PIX e boleto. Consulta nossa equipe pra condições especiais.",
          },
          {
            id: "4",
            question: "Tem garantia?",
            answer:
              "Sim. Garantia incondicional de 7 dias após o evento. Se não fizer sentido pra você, devolvemos 100%.",
          },
        ],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 10. CTA FINAL ──
      pushAt({
        type: "section-cta",
        x: 0, y: 0, w: 1200, h: 480,
        heading: "Espero ajudar você a encontrar o seu lugar.",
        headingAccent: "Você me permite?",
        subtitle:
          "Vagas limitadas pra manter a qualidade da experiência. Quando lotar, fecha.",
        primaryCta: "GARANTIR INGRESSO AGORA",
        secondaryCta: "Clique aqui pra falar com um especialista",
        guarantees: ["🛡 7 dias de garantia", "💳 Parcela em 12x", "📞 1ª semana acompanhada"],
        bgColor: T.bg, fgColor: T.fg, primaryColor: T.primary, mutedColor: T.muted,
      }),

      // ── 11. FOOTER ──
      pushAt({
        type: "section-footer",
        x: 0, y: 0, w: 1200, h: 140,
        logoText: "A MINA",
        tagline: "Imersão Leonardo Loureiro",
        copyright: "© 2025 Leonardo Loureiro · Todos os direitos reservados",
        links: [
          { id: "1", label: "Política de Privacidade", href: "#" },
          { id: "2", label: "Termos & Condições", href: "#" },
          { id: "3", label: "Contato", href: "#" },
        ],
        bgColor: T.bg, fgColor: T.fg, mutedColor: T.muted,
      }),
    ],
  };
}

/**
 * Tokens pro Aulão LiftBumbum® Pós-PMMA — paleta navy + dourado
 * champanhe pra passar autoridade clínica e estética premium.
 */
const AULAO_LIFTBUMBUM_TOKENS = {
  primary: "#D4AF37", // dourado champanhe — botões e destaques
  accent: "#F4C2C2",  // rose powder — toques femininos
  bg: "#0F172A",      // navy escuro — fundo principal
  fg: "#F8FAFC",      // off-white — texto principal
  muted: "#94A3B8",   // cinza médio — textos secundários
};

/**
 * Template "Aulão LiftBumbum® — Pós-PMMA" — landing de captação +
 * conversão pra aulão ao vivo no Google Meet sobre harmonização
 * glútea segura num cenário pós-banimento do PMMA.
 *
 * 12 blocos seguindo a arquitetura estratégica:
 *   1.  Navbar sticky com badge "🔴 AO VIVO" + CTA
 *   2.  Hero — headline "O FIM DO PMMA?" + oferta R$ 99,90 + CTA
 *   3.  Stats fininha — formato/data/preço
 *   4.  Ponte da empatia — 6 cards de dores ("você se sente assim?")
 *   5.  Problema — explicação do cenário PMMA
 *   6.  Oportunidade — 3 cards (ticket, ativos, posicionamento)
 *   7.  Conteúdo do aulão — 8 cards numerados (o que vai aprender)
 *   8.  Autoridade Dra. Thaine — 1 card grande com bio + quote
 *   9.  Depoimentos — 3 testimonials de alunas
 *   10. Oferta final / CTA — preço + bullets + botão escasso
 *   11. FAQ — 4 perguntas frequentes
 *   12. Footer — créditos + links
 *
 * Tom: autoridade clínica + urgência (banimento PMMA), sem soar
 * "guru de faturamento". Promessa-mãe: dominar segurança no
 * pós-PMMA = virar referência da cidade. Dinheiro vem como
 * consequência.
 *
 * Nota: pra incluir o formulário embedded (seção 9 do briefing),
 * o user precisa criar um Form NASA primeiro e arrastar o
 * `embedded-form` na page editando — formId é configurado
 * runtime no editor, não no template.
 */
function aulaoLiftbumbumPosPmma(): Omit<
  PageTemplate,
  "id" | "name" | "description" | "category" | "intent"
> {
  resetY();
  const T = AULAO_LIFTBUMBUM_TOKENS;
  return {
    tokens: T,
    elements: [
      // ── 1. NAVBAR (sticky topo) ──
      pushAt({
        type: "section-navbar",
        x: 0, y: 0, w: 1200, h: 72,
        logoText: "LIFTBUMBUM®",
        logoSrc: "",
        logoHref: "#top",
        links: [
          { id: "l1", label: "Aulão", href: "#aulao" },
          { id: "l2", label: "Programa", href: "#programa" },
          { id: "l3", label: "Mentora", href: "#mentora" },
          { id: "l4", label: "Depoimentos", href: "#depoimentos" },
        ],
        primaryCta: "QUERO MINHA VAGA",
        primaryCtaHref: "#oferta-final",
        secondaryCta: "🔴 17/06 · 20H",
        secondaryCtaHref: "#hero",
        bgColor: T.bg,
        fgColor: T.fg,
        primaryColor: T.primary,
        mutedColor: T.muted,
      }),

      // ── 2. HERO — headline + oferta + 1º botão ──
      pushAt({
        type: "section-hero",
        x: 0, y: 0, w: 1200, h: 720,
        anchorId: "hero",
        badge: "📅 17 DE JUNHO · 20H BRASÍLIA · AO VIVO NO GOOGLE MEET",
        titleLine1: "LIFTBUMBUM® — O FIM DO PMMA?",
        titleLine2: "Segurança vira sua maior vantagem competitiva.",
        subtitle:
          "O PMMA está sendo banido, questionado e abandonado. Enquanto muitos profissionais ainda estão perdidos sobre o que usar, você pode se tornar a referência em harmonização glútea segura da sua cidade. Aprenda o raciocínio clínico e a escolha de ativos com respaldo científico — e cobre por isso.",
        imageUrl: "",
        backgroundImage: "",
        backgroundOverlay:
          "linear-gradient(180deg, rgba(15,23,42,0.78) 0%, rgba(15,23,42,0.92) 100%)",
        backgroundPosition: "center",
        // Lista de botões — primary R$ 99,90 + secundário escassez
        buttons: [
          {
            id: "btn-hero-1",
            label: "QUERO MINHA VAGA POR R$ 99,90",
            href: "#oferta-final",
            variant: "primary",
          },
          {
            id: "btn-hero-2",
            label: "De R$ 497 por R$ 99,90 · só hoje",
            href: "#oferta-final",
            variant: "ghost",
          },
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        primaryColor: T.primary,
        mutedColor: T.muted,
      }),

      // ── 3. STATS — formato/data/preço/escassez ──
      pushAt({
        type: "section-stats",
        x: 0, y: 0, w: 1200, h: 160,
        stats: [
          { id: "s1", value: "17/06", label: "Quarta · 20h Brasília" },
          { id: "s2", value: "120min", label: "De aula prática" },
          { id: "s3", value: "R$ 99,90", label: "12x de R$ 9,68" },
          { id: "s4", value: "87%", label: "Vagas preenchidas" },
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        primaryColor: T.primary,
        mutedColor: T.muted,
      }),

      // ── 4. PONTE DA EMPATIA — "você se sente assim?" (6 dores) ──
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 720,
        anchorId: "empatia",
        heading: "VOCÊ ESTÁ INSEGURA COM ESSE NOVO CENÁRIO?",
        subheading:
          "Se uma dessas frases já passou pela sua cabeça, este aulão é pra você. Vou te entregar o raciocínio clínico que separa quem só aplica de quem domina.",
        features: [
          {
            id: "d1",
            icon: "❓",
            title: "Confusa sobre o que usar agora?",
            description:
              "O PMMA está sendo abandonado e questionado. Você não sabe ao certo o que pode substituir com segurança.",
          },
          {
            id: "d2",
            icon: "⚠️",
            title: "Medo de intercorrências e complicações?",
            description:
              "Aplica, mas não domina o perfil de segurança de cada ativo. Cada agenda é uma noite mal-dormida.",
          },
          {
            id: "d3",
            icon: "🎯",
            title: "Sem saber qual protocolo indicar?",
            description:
              "Cada glúteo é único, mas você usa sempre a mesma técnica. Resultado: previsibilidade baixa.",
          },
          {
            id: "d4",
            icon: "🔬",
            title: "Aplica, mas não avalia o tecido?",
            description:
              "Falta o passo da análise estrutural. Sem isso o planejamento é chute e o paciente sente.",
          },
          {
            id: "d5",
            icon: "👀",
            title: "Pacientes pedindo segurança e você travada?",
            description:
              "Sem argumento técnico pra se posicionar como referência. Você compete por preço enquanto outras cobram caro.",
          },
          {
            id: "d6",
            icon: "💰",
            title: "Sem coragem de cobrar caro pela segurança?",
            description:
              "Entrega trabalho de elite mas precifica como iniciante. O ticket não acompanha a expertise.",
          },
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        primaryColor: T.primary,
        mutedColor: T.muted,
      }),

      // ── 5. PROBLEMA — "PMMA acabou. E agora?" (texto + 3 bullets) ──
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 520,
        anchorId: "problema",
        heading: "O PMMA ACABOU. E AGORA?",
        subheading:
          "O PMMA (polimetilmetacrilato) é proibido para fins estéticos em diversos países e tem uso restrito no Brasil. O debate sobre os riscos voltou ao centro das atenções — e com ele, uma multidão de pacientes inseguros e profissionais sem direção.",
        features: [
          {
            id: "p1",
            icon: "💉",
            title: "Aplicação sem entendimento",
            description:
              "Muitos ainda aplicam substâncias sem entender o perfil de segurança de cada uma — e os pacientes pagam o preço.",
          },
          {
            id: "p2",
            icon: "📐",
            title: "Avaliação ignorada",
            description:
              "Espessura do tecido, plano correto, biossegurança — passos pulados que viram complicação evitável.",
          },
          {
            id: "p3",
            icon: "💎",
            title: "Quem entende, vira referência",
            description:
              "Nem tudo que dá volume tem o mesmo perfil de segurança. Quem domina isso e sabe explicar não compete por preço — vira autoridade.",
          },
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        primaryColor: T.primary,
        mutedColor: T.muted,
      }),

      // ── 6. OPORTUNIDADE — 3 cards ──
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 520,
        anchorId: "oportunidade",
        heading:
          "A HARMONIZAÇÃO GLÚTEA SEGURA É O MERCADO MAIS VALIOSO DE 2026",
        subheading:
          "O fim do PMMA não é uma crise — é a maior janela de oportunidade da estética avançada. O paciente nunca buscou tanto SEGURANÇA, e está disposto a pagar mais por ela.",
        features: [
          {
            id: "o1",
            icon: "💰",
            title: "Ticket alto justificado",
            description:
              "Protocolos com respaldo científico têm o maior valor percebido. O paciente paga 3x mais por segurança real.",
          },
          {
            id: "o2",
            icon: "🧬",
            title: "Bioestimuladores + Ácido Hialurônico",
            description:
              "As alternativas estudadas, aprovadas e previsíveis. A combinação certa transforma resultado.",
          },
          {
            id: "o3",
            icon: "👑",
            title: "Posicionamento de elite",
            description:
              "Ser 'a profissional que faz com segurança' é o melhor argumento de venda da estética hoje. Imbatível.",
          },
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        primaryColor: T.primary,
        mutedColor: T.muted,
      }),

      // ── 7. PROGRAMA — o que vai aprender (8 cards numerados) ──
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 900,
        anchorId: "programa",
        heading: "O QUE VOCÊ VAI DOMINAR NESTE AULÃO",
        subheading:
          "120 minutos de conteúdo prático e direto. Você sai com o método e a clareza pra aplicar na próxima paciente.",
        features: [
          {
            id: "c1",
            icon: "1️⃣",
            title: "O cenário pós-PMMA",
            description:
              "O que mudou, o que é proibido e o que o paciente está pedindo. Panorama completo de regulação e tendências.",
          },
          {
            id: "c2",
            icon: "2️⃣",
            title: "Alternativas seguras",
            description:
              "Bioestimuladores de colágeno e ácido hialurônico: quando usar, onde aplicar e por quê — com respaldo científico.",
          },
          {
            id: "c3",
            icon: "3️⃣",
            title: "Leitura estrutural do glúteo",
            description:
              "Avaliação de flacidez, celulite e sustentação. O passo-a-passo da análise que orienta a escolha.",
          },
          {
            id: "c4",
            icon: "4️⃣",
            title: "Tratamento em camadas",
            description:
              "Bioestimulador para estrutura, ácido hialurônico para contorno. Como combinar pra resultado completo.",
          },
          {
            id: "c5",
            icon: "5️⃣",
            title: "Anatomia estratégica",
            description:
              "Zonas seguras, de atenção e de risco. O mapa que evita intercorrência e dá previsibilidade.",
          },
          {
            id: "c6",
            icon: "6️⃣",
            title: "Biossegurança rígida",
            description:
              "Como evitar infecções e intercorrências. O protocolo que protege paciente e profissional.",
          },
          {
            id: "c7",
            icon: "7️⃣",
            title: "Planejamento individualizado",
            description:
              "Não existe protocolo único — cada paciente, uma estratégia. O raciocínio que personaliza cada caso.",
          },
          {
            id: "c8",
            icon: "8️⃣",
            title: "Posicionamento e vendas",
            description:
              "Como se tornar a referência em segurança da sua cidade — e cobrar por isso. Argumentos, scripts e ticket.",
          },
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        primaryColor: T.primary,
        mutedColor: T.muted,
      }),

      // ── 8. AUTORIDADE — Dra. Thaine (1 card grande + quote) ──
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 560,
        anchorId: "mentora",
        heading: "QUEM VAI TE ENSINAR",
        subheading:
          "Dra. Thaine Malinowski — mais de 18 anos de experiência em saúde e estética corporal, criadora do consagrado Método LiftBumbum®, referência nacional em harmonização corporal e formação de profissionais da estética avançada. Lidera a Modelart Estética & Saúde, com unidades em Manaus e Boa Vista.",
        features: [
          {
            id: "a1",
            icon: "💬",
            title:
              '"Segurança sempre vem antes da tendência."',
            description:
              '"Segurança sempre deve vir antes de qualquer tendência estética. O resultado seguro e harmonioso depende de análise criteriosa, escolha adequada dos produtos e experiência do profissional." — Dra. Thaine Malinowski · @drathainemalinowski',
          },
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        primaryColor: T.primary,
        mutedColor: T.muted,
      }),

      // ── 9. CTA INTERMEDIÁRIO (botão 2) ──
      pushAt({
        type: "section-cta",
        x: 0, y: 0, w: 1200, h: 360,
        anchorId: "cta-meio",
        heading: "Vagas limitadas.",
        headingAccent: "Já fechamos 87%.",
        subtitle:
          "Não fique sem a sua. O grupo VIP já está em movimento e a próxima turma é só em 2027.",
        buttons: [
          {
            id: "btn-meio-1",
            label: "QUERO GARANTIR MINHA VAGA",
            href: "#oferta-final",
            variant: "primary",
          },
        ],
        guarantees: [
          "🔒 Compra 100% segura",
          "⚡ Acesso imediato ao Grupo VIP",
          "🎯 Garantia de 7 dias",
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        primaryColor: T.primary,
        mutedColor: T.muted,
      }),

      // ── 10. PROVA SOCIAL — depoimentos ──
      pushAt({
        type: "section-testimonials",
        x: 0, y: 0, w: 1200, h: 480,
        anchorId: "depoimentos",
        heading: "O QUE AS ALUNAS DIZEM SOBRE O LIFTBUMBUM®",
        testimonials: [
          {
            id: "t1",
            quote:
              "Eu já tinha cursos com 'as grandes' do mercado e nenhum me deu o raciocínio que a Dra. Thaine me passou. Hoje cobro 3x mais e durmo tranquila.",
            author: "Dra. Camila R.",
            role: "Biomédica · Goiânia",
            avatar: "https://i.pravatar.cc/120?img=5",
          },
          {
            id: "t2",
            quote:
              "Em 4 meses depois do Aulão, virei a referência em harmonização segura da minha cidade. Agenda de 6 meses pra frente.",
            author: "Dra. Mariana L.",
            role: "Fisioterapeuta dermato · Ribeirão",
            avatar: "https://i.pravatar.cc/120?img=20",
          },
          {
            id: "t3",
            quote:
              "Saí do PMMA com medo e voltei pra clínica com plano. Bioestimulador + AH agora é meu carro-chefe. Ticket subiu, complicação caiu.",
            author: "Dra. Patrícia S.",
            role: "Enfermeira esteta · Florianópolis",
            avatar: "https://i.pravatar.cc/120?img=23",
          },
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        primaryColor: T.primary,
        mutedColor: T.muted,
      }),

      // ── 11. OFERTA FINAL — preço, bullets, botão escasso ──
      pushAt({
        type: "section-cta",
        x: 0, y: 0, w: 1200, h: 640,
        anchorId: "oferta-final",
        heading: "ACESSO IMEDIATO AO CONHECIMENTO",
        headingAccent: "QUE GERA SEGURANÇA E RESULTADO.",
        subtitle:
          "Você vai sair do Aulão com o raciocínio por trás da técnica — aquilo que forma profissionais seguras, confiantes e bem pagas. Inclui: aulão completo · método de planejamento · estratégia de precificação · posicionamento de referência · BÔNUS: Grupo VIP imediato. De R$ 497 por apenas R$ 99,90 à vista (ou 12x de R$ 9,68). Menos que o custo de uma única intercorrência que você pode evitar.",
        buttons: [
          {
            id: "btn-final-1",
            label: "QUERO ME TORNAR REFERÊNCIA EM SEGURANÇA",
            href: "https://pagamento.exemplo.com/aulao-liftbumbum",
            variant: "primary",
          },
          {
            id: "btn-final-2",
            label: "💳 12x de R$ 9,68 sem juros",
            href: "https://pagamento.exemplo.com/aulao-liftbumbum",
            variant: "ghost",
          },
        ],
        guarantees: [
          "🔒 Compra 100% segura",
          "⚡ Acesso imediato ao Grupo VIP",
          "📱 Pelo WhatsApp e e-mail",
          "🎯 Garantia de 7 dias",
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        primaryColor: T.primary,
        mutedColor: T.muted,
      }),

      // ── 12. FAQ ──
      pushAt({
        type: "section-faq",
        x: 0, y: 0, w: 1200, h: 480,
        anchorId: "faq",
        heading: "DÚVIDAS FREQUENTES",
        items: [
          {
            id: "f1",
            question: "Quando é o aulão?",
            answer:
              "17 de junho de 2026, às 20h (Brasília), ao vivo no Google Meet. O link chega pelo WhatsApp e e-mail informados no cadastro.",
          },
          {
            id: "f2",
            question: "Vou receber a gravação?",
            answer:
              "Sim — todas as alunas recebem acesso à gravação por 30 dias após o aulão, junto com o material complementar enviado no Grupo VIP.",
          },
          {
            id: "f3",
            question: "Preciso já atuar na área?",
            answer:
              "Não. O Aulão serve tanto pra quem já atua e quer atualizar o repertório pós-PMMA, quanto pra quem quer entrar com segurança e estrutura clínica desde o início.",
          },
          {
            id: "f4",
            question: "Como recebo o acesso ao Grupo VIP?",
            answer:
              "Logo após o pagamento, você recebe pelo WhatsApp e pelo e-mail cadastrados o link de entrada no Grupo VIP — onde o material extra e a interação com a Dra. Thaine acontecem.",
          },
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        primaryColor: T.primary,
        mutedColor: T.muted,
      }),

      // ── 13. FOOTER ──
      pushAt({
        type: "section-footer",
        x: 0, y: 0, w: 1200, h: 200,
        logoText: "LIFTBUMBUM®",
        logoSrc: "",
        tagline:
          "Método de harmonização glútea segura criado pela Dra. Thaine Malinowski.",
        copyright:
          "© 2026 LiftBumbum® · Modelart Estética & Saúde · Todos os direitos reservados",
        links: [
          { id: "fl1", label: "Política de Privacidade", href: "#" },
          { id: "fl2", label: "Termos de Uso", href: "#" },
          { id: "fl3", label: "Suporte", href: "https://wa.me/" },
          { id: "fl4", label: "Instagram", href: "https://instagram.com/drathainemalinowski" },
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        mutedColor: T.muted,
      }),
    ],
  };
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "aulao-liftbumbum-pos-pmma",
    name: "Aulão LiftBumbum® — Pós-PMMA",
    description:
      "Landing de captação + conversão pra aulão ao vivo sobre harmonização glútea segura pós-banimento do PMMA. 13 blocos com navbar sticky, hero com badge AO VIVO, stats fininha, 6 cards de empatia, problema + oportunidade, 8 itens de programa, autoridade Dra. Thaine, CTA mid, depoimentos, oferta final R$ 99,90 e FAQ. Paleta navy + dourado champanhe (autoridade clínica).",
    intent: "EVENT",
    category: "Eventos",
    ...aulaoLiftbumbumPosPmma(),
  },
  {
    id: "a-mina-imersao",
    name: "A MINA — Imersão Leonardo Loureiro",
    description:
      "Réplica da landing de imersão presencial de 3 dias (a-mina) sobre empreendedorismo + propósito + família. Tema dourado (#CEB15D) em fundo escuro. 12 blocos: navbar, hero, stats, mídia, 2 features (pilares + aprendizados), 3 níveis de ingresso no pricing, CTA mid, depoimentos, FAQ, CTA final, footer.",
    intent: "EVENT",
    category: "Eventos",
    ...aMinaImersao(),
  },
  {
    id: "nasa-orbita-landing",
    name: "Landing NASA Orbita (PR #82)",
    description:
      "Réplica da landing institucional do NASA (orbita.nasaex.com). 13 blocos cobrindo a narrativa 'OS do processo': hero, stats, marquee, método, automação, apps, Astro, integrações, leaderboard ao vivo, planos, depoimentos, FAQ, CTA. Mostra na prática 10 dos novos ElementTypes do builder.",
    intent: "INSTITUTIONAL",
    category: "Sales",
    ...nasaOrbitaLanding(),
  },
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
