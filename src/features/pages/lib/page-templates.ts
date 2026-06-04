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
        links: [
          { id: "1", label: "Planos", href: "#planos" },
          { id: "2", label: "O que é NASA?", href: "#o-que-e-nasa" },
          { id: "3", label: "Como funciona", href: "#como-funciona" },
        ],
        primaryCta: "Começar grátis",
        secondaryCta: "Entrar",
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
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 460,
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
      pushAt({
        type: "section-features",
        x: 0, y: 0, w: 1200, h: 460,
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
      pushAt({
        type: "section-pricing",
        x: 0, y: 0, w: 1200, h: 560,
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
      pushAt({
        type: "section-cta",
        x: 0, y: 0, w: 1200, h: 460,
        heading: "O processo que mais te dói",
        headingAccent: "pode estar em órbita até sexta-feira.",
        subtitle: "Sem cartão. Sem trocar tudo às cegas. A gente monta o lançamento com você.",
        primaryCta: "Começar meu primeiro processo",
        secondaryCta: "Ver demo ao vivo",
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

export const PAGE_TEMPLATES: PageTemplate[] = [
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
