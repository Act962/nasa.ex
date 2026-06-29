/**
 * Biblioteca de blocos reutilizáveis pra aba "Blocos" do builder.
 *
 * Cada bloco é uma SECTION pronta (section-testimonials, section-hero,
 * etc) com props já preenchidas — texto + tipografia + paleta. Click
 * insere no canvas; drag posiciona via aba Camadas.
 *
 * Categorias (do user):
 *   hero, testimonials, features, pricing, faq, cta, navbar, footer,
 *   stats, logos, carousel
 *
 * Convenções:
 *   - Cada bloco retorna `Partial<ElementBase>` (sem id, x, y, w, h —
 *     o builder-sidebar preenche via factory + computeInsertPosition).
 *   - Preview é uma string CSS curta — desenhada pelo BlockPreview no
 *     sidebar com gradient + linhas representando estrutura. Sem
 *     screenshot real (pesa).
 *   - `defaultTokens` é injetado quando útil pra que cor primary do
 *     bloco respeite a paleta da página atual.
 */
import type { ElementBase, ElementType } from "../types";

export type BlockCategory =
  | "hero"
  | "testimonials"
  | "features"
  | "pricing"
  | "faq"
  | "cta"
  | "navbar"
  | "footer"
  | "stats"
  | "logos"
  | "carousel";

export interface BlockDef {
  id: string;
  category: BlockCategory;
  label: string;
  description?: string;
  /** Tipo do element que será criado. Determina dimensões via element-factory. */
  type: ElementType;
  /** Tailwind classes pra mini-preview (gradient + ícone). */
  previewClass: string;
  /** Linhas que vão sobrepor o preview (representando estrutura). */
  previewLines?: { width: string; opacity?: number; align?: "left" | "center" | "right" }[];
  /** Constrói a section completa com props ricas. */
  build: () => Partial<ElementBase>;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  HERO (5)                                                          */
/* ─────────────────────────────────────────────────────────────────── */

const HERO: BlockDef[] = [
  {
    id: "hero-saas-image-right",
    category: "hero",
    label: "Hero SaaS clássico",
    description: "Título à esquerda, imagem à direita, 2 CTAs",
    type: "section-hero",
    previewClass: "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500",
    previewLines: [
      { width: "60%", align: "left" },
      { width: "45%", align: "left", opacity: 0.6 },
      { width: "30%", align: "left" },
    ],
    build: () => ({
      badge: "★ Novidade",
      titleLine1: "Sua empresa em",
      titleLine2: "uma única plataforma.",
      subtitle:
        "Centralize leads, atendimento e vendas. Comece grátis em 5 minutos.",
      primaryCta: "Começar grátis",
      secondaryCta: "Ver demo",
      imageUrl:
        "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80",
      headingStyle: { fontSize: 56, fontWeight: "900", lineHeight: 1.05 },
    }),
  },
  {
    id: "hero-centered-no-image",
    category: "hero",
    label: "Hero centralizado",
    description: "Tipografia forte, sem imagem",
    type: "section-hero",
    previewClass: "bg-gradient-to-b from-slate-900 to-slate-700",
    previewLines: [
      { width: "70%", align: "center" },
      { width: "50%", align: "center", opacity: 0.6 },
      { width: "25%", align: "center" },
    ],
    build: () => ({
      titleLine1: "A revolução que sua",
      titleLine2: "operação esperava.",
      subtitle:
        "Pare de pular entre 7 ferramentas. Tudo num lugar só, simples e poderoso.",
      primaryCta: "Quero conhecer",
      secondaryCta: "",
      imageUrl: "",
      headingStyle: { fontSize: 64, fontWeight: "900", align: "center", lineHeight: 1.05 },
      subheadingStyle: { fontSize: 18, align: "center" },
    }),
  },
  {
    id: "hero-event-elegant",
    category: "hero",
    label: "Hero evento elegante",
    description: "Pra landings de evento/aulão (estilo Aulão LiftBumbum)",
    type: "section-hero",
    previewClass: "bg-gradient-to-br from-amber-700 via-yellow-600 to-amber-500",
    previewLines: [
      { width: "40%", align: "center", opacity: 0.5 },
      { width: "80%", align: "center" },
      { width: "60%", align: "center", opacity: 0.7 },
      { width: "35%", align: "center" },
    ],
    build: () => ({
      badge: "AULÃO AO VIVO · 17/06",
      titleLine1: "O segredo que ninguém",
      titleLine2: "te contou.",
      subtitle:
        "Inscrição limitada. Conteúdo exclusivo. Bônus só pra quem está ao vivo.",
      primaryCta: "Quero minha vaga",
      secondaryCta: "Saber mais",
      imageUrl: "",
      headingStyle: {
        fontSize: 60,
        fontWeight: "900",
        align: "center",
        color: "#FFFFFF",
        lineHeight: 1.05,
      },
      subheadingStyle: { fontSize: 17, align: "center", color: "#FED7AA" },
    }),
  },
  {
    id: "hero-minimal-typography",
    category: "hero",
    label: "Hero minimalista",
    description: "Só tipografia + 1 CTA, foco no produto",
    type: "section-hero",
    previewClass: "bg-white border-2 border-slate-200",
    previewLines: [
      { width: "55%", align: "left" },
      { width: "20%", align: "left" },
    ],
    build: () => ({
      titleLine1: "Trabalho que",
      titleLine2: "se faz só.",
      subtitle: "Plataforma única. Resultado real.",
      primaryCta: "Começar",
      secondaryCta: "",
      imageUrl: "",
      headingStyle: {
        fontSize: 80,
        fontWeight: "900",
        align: "left",
        color: "#0F172A",
        lineHeight: 0.95,
        letterSpacing: -3,
      },
      subheadingStyle: { fontSize: 18, align: "left", color: "#64748B" },
    }),
  },
  {
    id: "hero-product-launch",
    category: "hero",
    label: "Hero lançamento de produto",
    description: "Foto centralizada + título embaixo (Stripe-style)",
    type: "section-hero",
    previewClass: "bg-gradient-to-b from-slate-50 to-slate-200",
    previewLines: [
      { width: "30%", align: "center", opacity: 0.5 },
      { width: "65%", align: "center" },
      { width: "45%", align: "center", opacity: 0.7 },
    ],
    build: () => ({
      badge: "LANÇAMENTO",
      titleLine1: "Apresentamos a",
      titleLine2: "próxima geração.",
      subtitle: "Tudo o que faltava no seu fluxo, sem o que você não precisava.",
      primaryCta: "Ver demo",
      secondaryCta: "Documentação",
      imageUrl:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80",
    }),
  },
];

/* ─────────────────────────────────────────────────────────────────── */
/*  TESTIMONIALS (4)                                                  */
/* ─────────────────────────────────────────────────────────────────── */

const TESTIMONIALS: BlockDef[] = [
  {
    id: "testimonials-3-cards",
    category: "testimonials",
    label: "3 depoimentos com foto",
    description: "Cards horizontais com foto, nome e cargo",
    type: "section-testimonials",
    previewClass: "bg-gradient-to-br from-blue-50 to-indigo-50",
    previewLines: [
      { width: "45%", align: "center" },
      { width: "95%", align: "left", opacity: 0.5 },
    ],
    build: () => ({
      heading: "O que dizem por aí",
      testimonials: [
        {
          id: "t1",
          quote: "Em 2 meses, dobrei minha conversão. O processo virou um só.",
          author: "Mariana F.",
          role: "Studio MF Design",
          avatar: "https://i.pravatar.cc/120?img=5",
        },
        {
          id: "t2",
          quote: "Saí de 7 ferramentas pra uma. Time inteiro agradeceu.",
          author: "Rafael Lima",
          role: "Lima Consultoria",
          avatar: "https://i.pravatar.cc/120?img=11",
        },
        {
          id: "t3",
          quote: "A IA conhece o histórico de cada cliente. Game changer.",
          author: "Ana Carvalho",
          role: "AC Imóveis",
          avatar: "https://i.pravatar.cc/120?img=20",
        },
      ],
    }),
  },
  {
    id: "testimonials-single-large",
    category: "testimonials",
    label: "1 depoimento gigante",
    description: "Quote única com foto grande à esquerda",
    type: "section-testimonials",
    previewClass: "bg-gradient-to-r from-slate-900 to-slate-700",
    previewLines: [
      { width: "30%", align: "center", opacity: 0.4 },
      { width: "85%", align: "center" },
      { width: "35%", align: "center", opacity: 0.7 },
    ],
    build: () => ({
      heading: "",
      testimonials: [
        {
          id: "t1",
          quote:
            "Eu tentei tudo antes desse método. Foi a primeira coisa que funcionou de verdade — e em 3 semanas eu já tinha o resultado que perseguia há 2 anos.",
          author: "Dra. Thaine Oliveira",
          role: "Especialista em medicina estética · 12k+ pacientes",
          avatar: "https://i.pravatar.cc/200?img=47",
        },
      ],
      quoteStyle: { fontSize: 24, italic: true, lineHeight: 1.5 },
      authorStyle: { fontSize: 18, fontWeight: "700" },
      cardPadding: 40,
      cardRadius: 20,
    }),
  },
  {
    id: "testimonials-whatsapp-prints",
    category: "testimonials",
    label: "Prints de WhatsApp",
    description: "Cards estilo conversa de WhatsApp (verde, hora, nome)",
    type: "section-testimonials",
    previewClass: "bg-gradient-to-br from-green-200 via-green-100 to-emerald-50",
    previewLines: [
      { width: "60%", align: "left" },
      { width: "70%", align: "left", opacity: 0.7 },
      { width: "55%", align: "right" },
    ],
    build: () => ({
      heading: "O que chega no nosso WhatsApp",
      testimonials: [
        {
          id: "t1",
          quote:
            "Cara, surreal a virada. Minha agenda lotou em 1 mês. Tô realizando vagas que tinham fila de espera 😍",
          author: "Carla M.",
          role: "11:42",
          avatar: "https://i.pravatar.cc/120?img=9",
          cardBg: "#DCF8C6",
          cardBorder: "#A8E0A8",
        },
        {
          id: "t2",
          quote:
            "Cheguei agora em casa e queria mandar o feedback aquecidinho: o que você ensinou MUDOU minha clínica. Obrigada, obrigada, obrigada 🙏✨",
          author: "Patrícia R.",
          role: "20:08",
          avatar: "https://i.pravatar.cc/120?img=23",
          cardBg: "#DCF8C6",
          cardBorder: "#A8E0A8",
        },
        {
          id: "t3",
          quote:
            "Faturamento esse mês foi 3x. Não dá pra colocar em palavras o que isso muda na minha vida 🥹",
          author: "Júlia C.",
          role: "ontem",
          avatar: "https://i.pravatar.cc/120?img=44",
          cardBg: "#DCF8C6",
          cardBorder: "#A8E0A8",
        },
      ],
      quoteStyle: { fontSize: 15, lineHeight: 1.5, italic: false },
      authorStyle: { fontSize: 13, fontWeight: "700", color: "#075E54" },
      roleStyle: { fontSize: 11, color: "#667781" },
      cardRadius: 12,
      cardPadding: 16,
    }),
  },
  {
    id: "testimonials-stories-grid",
    category: "testimonials",
    label: "Stories Instagram",
    description: "Grid de prints estilo story do IG (vertical)",
    type: "section-testimonials",
    previewClass: "bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400",
    previewLines: [
      { width: "50%", align: "center" },
      { width: "80%", align: "left", opacity: 0.6 },
    ],
    build: () => ({
      heading: "Alunas que confiaram e viraram referência",
      testimonials: [
        {
          id: "t1",
          quote: "MUDOU MINHA VIDA",
          author: "@mari_estetica",
          role: "Story · há 2h",
          avatar: "https://i.pravatar.cc/120?img=32",
          cardBg: "#000000",
          quoteStyle: {
            color: "#FFFFFF",
            fontSize: 22,
            fontWeight: "900",
            align: "center",
            lineHeight: 1.2,
          },
          authorStyle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
          roleStyle: { color: "#E879F9", fontSize: 11 },
        },
        {
          id: "t2",
          quote: "GRATIDÃO ETERNA POR ESSE MÉTODO 🙏",
          author: "@dra.paulasouza",
          role: "Story · há 5h",
          avatar: "https://i.pravatar.cc/120?img=48",
          cardBg: "#1F2937",
          quoteStyle: {
            color: "#FFFFFF",
            fontSize: 20,
            fontWeight: "900",
            align: "center",
            lineHeight: 1.2,
          },
          authorStyle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
          roleStyle: { color: "#FCD34D", fontSize: 11 },
        },
        {
          id: "t3",
          quote: "SE EU TIVESSE CONHECIDO ANTES…",
          author: "@bianca_med",
          role: "Story · ontem",
          avatar: "https://i.pravatar.cc/120?img=15",
          cardBg: "#7C3AED",
          quoteStyle: {
            color: "#FFFFFF",
            fontSize: 22,
            fontWeight: "900",
            align: "center",
            lineHeight: 1.2,
          },
          authorStyle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
          roleStyle: { color: "#FBCFE8", fontSize: 11 },
        },
      ],
      cardRadius: 20,
      cardPadding: 32,
    }),
  },
];

/* ─────────────────────────────────────────────────────────────────── */
/*  FEATURES (4)                                                      */
/* ─────────────────────────────────────────────────────────────────── */

const FEATURES: BlockDef[] = [
  {
    id: "features-3-icons",
    category: "features",
    label: "3 cards com ícone",
    description: "Layout clássico SaaS — emoji + título + descrição",
    type: "section-features",
    previewClass: "bg-gradient-to-br from-slate-50 to-slate-100",
    previewLines: [
      { width: "50%", align: "center" },
      { width: "85%", align: "left", opacity: 0.5 },
    ],
    build: () => ({
      heading: "Por que escolher a gente",
      subheading: "3 motivos pra você acreditar antes mesmo de testar.",
      features: [
        { id: "f1", icon: "⚡", title: "Rápido", description: "Configure tudo em minutos, sem precisar de dev." },
        { id: "f2", icon: "🛡", title: "Seguro", description: "Criptografia ponta a ponta + LGPD compliant." },
        { id: "f3", icon: "🚀", title: "Escalável", description: "Cresce com sua empresa, sem limite artificial." },
      ],
    }),
  },
  {
    id: "features-4-icons-dense",
    category: "features",
    label: "4 cards densos",
    description: "Grid 2x2 com ícones e textos curtos",
    type: "section-features",
    previewClass: "bg-gradient-to-br from-blue-50 to-cyan-50",
    previewLines: [
      { width: "55%", align: "center" },
      { width: "92%", align: "left", opacity: 0.5 },
    ],
    build: () => ({
      heading: "Tudo o que você precisa, num só lugar",
      subheading: "Pare de pular entre apps.",
      features: [
        { id: "f1", icon: "🎯", title: "Captação", description: "Formulários, landing pages e UTM." },
        { id: "f2", icon: "💬", title: "Atendimento", description: "WhatsApp, Instagram e e-mail em uma caixa." },
        { id: "f3", icon: "📊", title: "Analytics", description: "Conversão, ROI e leads em tempo real." },
        { id: "f4", icon: "🤖", title: "Automação", description: "Workflows IA pra escalar sem mais gente." },
      ],
    }),
  },
  {
    id: "features-6-mini",
    category: "features",
    label: "6 mini-features",
    description: "Grid denso 3x2 com ícone + nome curto",
    type: "section-features",
    previewClass: "bg-white border-2 border-slate-200",
    previewLines: [
      { width: "40%", align: "center" },
      { width: "85%", align: "left", opacity: 0.4 },
    ],
    build: () => ({
      heading: "Inclui tudo que você precisa",
      subheading: "",
      features: [
        { id: "f1", icon: "📱", title: "Mobile-first", description: "Funciona perfeito em qualquer device." },
        { id: "f2", icon: "🔒", title: "Backup", description: "Diário, automático, criptografado." },
        { id: "f3", icon: "🌐", title: "Multi-idioma", description: "PT, EN, ES nativos." },
        { id: "f4", icon: "📤", title: "Exportação", description: "CSV, JSON, API REST." },
        { id: "f5", icon: "👥", title: "Multi-usuário", description: "Permissões granulares." },
        { id: "f6", icon: "🆘", title: "Suporte 24/7", description: "Time em PT, sempre." },
      ],
      iconSize: 28,
    }),
  },
  {
    id: "features-3-premium",
    category: "features",
    label: "3 features premium",
    description: "Cards grandes, padding generoso, paleta escura",
    type: "section-features",
    previewClass: "bg-gradient-to-br from-slate-900 to-slate-700",
    previewLines: [
      { width: "55%", align: "center", opacity: 0.9 },
      { width: "75%", align: "left", opacity: 0.5 },
    ],
    build: () => ({
      heading: "Construído pra quem leva sério",
      subheading: "Cada detalhe pensado por quem opera, não por quem só projeta.",
      features: [
        { id: "f1", icon: "🏆", title: "Performance enterprise", description: "Latência <100ms mesmo com milhões de registros. SLAs documentados." },
        { id: "f2", icon: "🔐", title: "Compliance", description: "LGPD, SOC2, ISO27001. Auditoria contínua, sem cobrança extra." },
        { id: "f3", icon: "🎓", title: "Onboarding personalizado", description: "Account Manager dedicado nos 30 primeiros dias. Migração inclusa." },
      ],
      iconSize: 40,
      cardPadding: 32,
      cardRadius: 20,
    }),
  },
];

/* ─────────────────────────────────────────────────────────────────── */
/*  PRICING (3)                                                       */
/* ─────────────────────────────────────────────────────────────────── */

const PRICING: BlockDef[] = [
  {
    id: "pricing-3-tiers",
    category: "pricing",
    label: "3 planos clássico",
    description: "Free / Pro destacado / Enterprise",
    type: "section-pricing",
    previewClass: "bg-gradient-to-br from-indigo-50 to-purple-50",
    previewLines: [
      { width: "60%", align: "center" },
      { width: "88%", align: "left", opacity: 0.5 },
    ],
    build: () => ({
      heading: "Planos pra todo tipo de time",
      subheading: "Sem cartão pra começar. Cancele quando quiser.",
      plans: [
        { id: "free", name: "Free", price: "R$ 0", period: "/mês", slogan: "Pra começar.", features: ["1 usuário", "Recursos básicos", "Comunidade"], ctaLabel: "Começar grátis" },
        { id: "pro", name: "Pro", price: "R$ 197", period: "/mês", slogan: "Pra equipes pequenas.", features: ["10 usuários", "Integrações", "Suporte prioritário", "Analytics avançado"], ctaLabel: "Assinar", highlighted: true, badge: "Mais popular" },
        { id: "ent", name: "Enterprise", price: "Sob consulta", slogan: "Pra grandes operações.", features: ["Ilimitado", "Gerente dedicado", "SLA personalizado", "Compliance custom"], ctaLabel: "Falar com vendas" },
      ],
    }),
  },
  {
    id: "pricing-2-tiers-vs",
    category: "pricing",
    label: "2 planos comparativo",
    description: "Pessoal vs Profissional, foco em conversão",
    type: "section-pricing",
    previewClass: "bg-gradient-to-r from-slate-100 to-slate-200",
    previewLines: [
      { width: "50%", align: "center" },
      { width: "82%", align: "left", opacity: 0.5 },
    ],
    build: () => ({
      heading: "Escolha como você quer crescer",
      subheading: "Sem letra miúda. Sem fidelidade.",
      plans: [
        { id: "personal", name: "Pessoal", price: "R$ 97", period: "/mês", slogan: "Pra autônomos.", features: ["1 usuário", "Até 500 leads/mês", "WhatsApp + e-mail", "Templates prontos"], ctaLabel: "Começar" },
        { id: "team", name: "Time", price: "R$ 297", period: "/mês", slogan: "Pra equipes que querem escalar.", features: ["Até 10 usuários", "Leads ilimitados", "Multi-canal completo", "IA inclusa", "Suporte prioritário"], ctaLabel: "Quero esse", highlighted: true, badge: "Recomendado" },
      ],
    }),
  },
  {
    id: "pricing-4-tiers",
    category: "pricing",
    label: "4 planos completo",
    description: "Starter / Growth / Pro / Enterprise",
    type: "section-pricing",
    previewClass: "bg-gradient-to-br from-emerald-50 to-teal-50",
    previewLines: [
      { width: "55%", align: "center" },
      { width: "92%", align: "left", opacity: 0.5 },
    ],
    build: () => ({
      heading: "Comece pequeno. Cresça sem trocar de ferramenta.",
      subheading: "Migre entre planos a qualquer momento.",
      plans: [
        { id: "starter", name: "Starter", price: "R$ 0", period: "/mês", slogan: "Teste sem compromisso.", features: ["100 leads", "1 usuário", "WhatsApp básico"], ctaLabel: "Começar grátis" },
        { id: "growth", name: "Growth", price: "R$ 97", period: "/mês", slogan: "Pra times pequenos.", features: ["1k leads", "3 usuários", "Multi-canal", "Templates"], ctaLabel: "Assinar" },
        { id: "pro", name: "Pro", price: "R$ 297", period: "/mês", slogan: "Pra empresas em escala.", features: ["10k leads", "10 usuários", "IA + automação", "Analytics avançado"], ctaLabel: "Assinar", highlighted: true, badge: "Mais vendido" },
        { id: "ent", name: "Enterprise", price: "Custom", slogan: "Pra operações grandes.", features: ["Ilimitado", "SLA dedicado", "On-premise opcional"], ctaLabel: "Falar com vendas" },
      ],
    }),
  },
];

/* ─────────────────────────────────────────────────────────────────── */
/*  FAQ (2)                                                           */
/* ─────────────────────────────────────────────────────────────────── */

const FAQ: BlockDef[] = [
  {
    id: "faq-basic",
    category: "faq",
    label: "FAQ accordion clássico",
    description: "5 perguntas em accordion expandável",
    type: "section-faq",
    previewClass: "bg-gradient-to-b from-white to-slate-100",
    previewLines: [
      { width: "50%", align: "center" },
      { width: "85%", align: "left", opacity: 0.4 },
      { width: "80%", align: "left", opacity: 0.4 },
      { width: "75%", align: "left", opacity: 0.4 },
    ],
    build: () => ({
      heading: "Perguntas frequentes",
      anchorId: "faq",
      items: [
        { id: "q1", question: "Preciso de cartão de crédito pra começar?", answer: "Não. O plano Free é gratuito pra sempre, sem cartão." },
        { id: "q2", question: "Como faço a migração dos meus dados?", answer: "Temos importadores nativos pra RD, Pipedrive, HubSpot e CSV. Primeira semana com acompanhamento incluído." },
        { id: "q3", question: "Posso cancelar a qualquer momento?", answer: "Sim. Cancelamento em 1 clique, sem multa, sem retenção." },
        { id: "q4", question: "A IA funciona com WhatsApp Business?", answer: "Sim — funciona com WhatsApp oficial (Cloud API) e via Twilio/Z-API. Setup em 5 minutos." },
        { id: "q5", question: "Tem suporte em português?", answer: "Sim, time 100% nacional, atendimento das 8h às 22h em dias úteis, e suporte por e-mail 24/7." },
      ],
    }),
  },
  {
    id: "faq-objection-killer",
    category: "faq",
    label: "FAQ destruidor de objeções",
    description: "Pra landings de evento — responde dúvidas comuns de inscrição",
    type: "section-faq",
    previewClass: "bg-gradient-to-br from-amber-50 to-orange-50",
    previewLines: [
      { width: "60%", align: "center" },
      { width: "82%", align: "left", opacity: 0.5 },
    ],
    build: () => ({
      heading: "Toda dúvida tem resposta",
      anchorId: "faq",
      items: [
        { id: "q1", question: "É ao vivo mesmo?", answer: "Sim — 100% ao vivo, com Q&A em tempo real. NÃO há replay." },
        { id: "q2", question: "Vou conseguir aplicar mesmo sendo iniciante?", answer: "Sim. O método foi desenhado pra quem está começando do zero. Cada passo é explicado." },
        { id: "q3", question: "Tem certificado?", answer: "Sim, certificado digital com 4h de carga horária após o aulão." },
        { id: "q4", question: "Tem garantia?", answer: "Sim — 7 dias de garantia incondicional. Não gostou? Devolvemos 100% do valor." },
      ],
      headingStyle: { fontSize: 36, fontWeight: "900", align: "center" },
    }),
  },
];

/* ─────────────────────────────────────────────────────────────────── */
/*  CTA (3)                                                           */
/* ─────────────────────────────────────────────────────────────────── */

const CTA: BlockDef[] = [
  {
    id: "cta-gradient-bold",
    category: "cta",
    label: "CTA gradient impactante",
    description: "Fundo gradient + título + 1 botão grande",
    type: "section-cta",
    previewClass: "bg-gradient-to-r from-purple-600 via-pink-500 to-red-500",
    previewLines: [
      { width: "70%", align: "center", opacity: 0.95 },
      { width: "50%", align: "center", opacity: 0.7 },
      { width: "30%", align: "center" },
    ],
    build: () => ({
      title: "Pronto pra começar agora?",
      subtitle: "Sem cartão, sem fidelidade. Em 5 minutos você já tá rodando.",
      primaryCta: "Quero começar",
      secondaryCta: "",
    }),
  },
  {
    id: "cta-minimal-card",
    category: "cta",
    label: "CTA card minimalista",
    description: "Card branco, sombra, copy curto e direto",
    type: "section-cta",
    previewClass: "bg-white border-2 border-slate-200",
    previewLines: [
      { width: "60%", align: "center" },
      { width: "30%", align: "center" },
    ],
    build: () => ({
      title: "Última chance.",
      subtitle: "As 50 vagas com bônus fecham hoje 23h59.",
      primaryCta: "Garantir minha vaga",
      secondaryCta: "",
    }),
  },
  {
    id: "cta-social-proof",
    category: "cta",
    label: "CTA com social proof",
    description: "Inclui '2.300+ empresas já confiam'",
    type: "section-cta",
    previewClass: "bg-gradient-to-b from-indigo-600 to-indigo-900",
    previewLines: [
      { width: "75%", align: "center" },
      { width: "55%", align: "center", opacity: 0.7 },
      { width: "40%", align: "center" },
    ],
    build: () => ({
      title: "Junte-se às 2.300+ empresas que já trocaram",
      subtitle: "Migração inclusa nos primeiros 30 dias. Sem dor de cabeça.",
      primaryCta: "Quero migrar",
      secondaryCta: "Falar com time",
    }),
  },
];

/* ─────────────────────────────────────────────────────────────────── */
/*  NAVBAR (2)                                                        */
/* ─────────────────────────────────────────────────────────────────── */

const NAVBAR: BlockDef[] = [
  {
    id: "navbar-classic",
    category: "navbar",
    label: "Navbar clássica",
    description: "Logo à esquerda, links no meio, CTA à direita",
    type: "section-navbar",
    previewClass: "bg-white border-b-2 border-slate-200",
    previewLines: [{ width: "92%", align: "left", opacity: 0.4 }],
    build: () => ({
      logoText: "Minha Marca",
      logoHref: "#top",
      links: [
        { id: "l1", label: "Recursos", href: "#features" },
        { id: "l2", label: "Preços", href: "#pricing" },
        { id: "l3", label: "Depoimentos", href: "#testimonials" },
        { id: "l4", label: "FAQ", href: "#faq" },
      ],
      primaryCta: "Começar grátis",
      secondaryCta: "Entrar",
      primaryCtaHref: "#cta-final",
      secondaryCtaHref: "/login",
    }),
  },
  {
    id: "navbar-dark-minimal",
    category: "navbar",
    label: "Navbar dark minimal",
    description: "Fundo escuro, logo + 1 CTA só",
    type: "section-navbar",
    previewClass: "bg-slate-900 border-b border-slate-700",
    previewLines: [{ width: "90%", align: "left", opacity: 0.5 }],
    build: () => ({
      logoText: "AURORA",
      logoHref: "#top",
      links: [
        { id: "l1", label: "Sobre", href: "#sobre" },
        { id: "l2", label: "Trabalhos", href: "#work" },
      ],
      primaryCta: "Conversar",
      secondaryCta: "",
      primaryCtaHref: "#contato",
    }),
  },
];

/* ─────────────────────────────────────────────────────────────────── */
/*  FOOTER (2)                                                        */
/* ─────────────────────────────────────────────────────────────────── */

const FOOTER: BlockDef[] = [
  {
    id: "footer-3-cols",
    category: "footer",
    label: "Footer 3 colunas",
    description: "Logo + tagline + 3 colunas de links",
    type: "section-footer",
    previewClass: "bg-slate-900",
    previewLines: [
      { width: "30%", align: "left", opacity: 0.6 },
      { width: "85%", align: "left", opacity: 0.4 },
    ],
    build: () => ({
      logoText: "Minha Marca",
      tagline: "A plataforma que sua operação esperava.",
      copyright: "© 2026 Minha Marca. Todos os direitos reservados.",
      links: [
        { id: "l1", label: "Sobre", href: "#sobre" },
        { id: "l2", label: "Recursos", href: "#features" },
        { id: "l3", label: "Preços", href: "#pricing" },
        { id: "l4", label: "Suporte", href: "/suporte" },
        { id: "l5", label: "Termos", href: "/termos" },
        { id: "l6", label: "Privacidade", href: "/privacidade" },
      ],
    }),
  },
  {
    id: "footer-minimal",
    category: "footer",
    label: "Footer single line",
    description: "1 linha — só copyright + 3 links essenciais",
    type: "section-footer",
    previewClass: "bg-slate-100 border-t-2 border-slate-300",
    previewLines: [{ width: "70%", align: "center", opacity: 0.4 }],
    build: () => ({
      logoText: "Minha Marca",
      tagline: "",
      copyright: "© 2026 Minha Marca",
      links: [
        { id: "l1", label: "Termos", href: "/termos" },
        { id: "l2", label: "Privacidade", href: "/privacidade" },
        { id: "l3", label: "Contato", href: "/contato" },
      ],
    }),
  },
];

/* ─────────────────────────────────────────────────────────────────── */
/*  STATS (2)                                                         */
/* ─────────────────────────────────────────────────────────────────── */

const STATS: BlockDef[] = [
  {
    id: "stats-4-numbers",
    category: "stats",
    label: "4 números horizontais",
    description: "Strip de stats clássica entre sections",
    type: "section-stats",
    previewClass: "bg-gradient-to-r from-indigo-100 to-purple-100",
    previewLines: [
      { width: "20%", align: "left", opacity: 0.6 },
      { width: "20%", align: "left", opacity: 0.6 },
      { width: "20%", align: "left", opacity: 0.6 },
      { width: "20%", align: "left", opacity: 0.6 },
    ],
    build: () => ({
      stats: [
        { id: "s1", value: "2.300+", label: "Empresas ativas" },
        { id: "s2", value: "847k", label: "Leads capturados" },
        { id: "s3", value: "89%", label: "Aumento em conversão" },
        { id: "s4", value: "200+", label: "Integrações" },
      ],
    }),
  },
  {
    id: "stats-3-impact",
    category: "stats",
    label: "3 stats impactantes",
    description: "Números gigantes, foco em uma narrativa",
    type: "section-stats",
    previewClass: "bg-gradient-to-b from-slate-900 to-slate-700",
    previewLines: [
      { width: "30%", align: "left", opacity: 0.8 },
      { width: "30%", align: "left", opacity: 0.8 },
      { width: "30%", align: "left", opacity: 0.8 },
    ],
    build: () => ({
      stats: [
        { id: "s1", value: "12x", label: "Mais rápido que ferramentas manuais" },
        { id: "s2", value: "73%", label: "De redução em custo operacional" },
        { id: "s3", value: "4.9 ★", label: "Avaliação média no G2" },
      ],
      valueStyle: { fontSize: 56, fontWeight: "900", color: "#FBBF24" },
      labelStyle: { fontSize: 13, color: "#E2E8F0" },
    }),
  },
];

/* ─────────────────────────────────────────────────────────────────── */
/*  LOGOS (1)                                                         */
/* ─────────────────────────────────────────────────────────────────── */

const LOGOS: BlockDef[] = [
  {
    id: "logos-trusted-by",
    category: "logos",
    label: "Logos parceiros",
    description: "Strip 'Confiam em nós' com 5 logos",
    type: "section-logo-cloud",
    previewClass: "bg-slate-50",
    previewLines: [
      { width: "40%", align: "center", opacity: 0.4 },
      { width: "85%", align: "left", opacity: 0.3 },
    ],
    build: () => ({
      heading: "Quem confia em nós",
      logos: [
        { id: "l1", imageUrl: "", alt: "Acme" },
        { id: "l2", imageUrl: "", alt: "Globex" },
        { id: "l3", imageUrl: "", alt: "Initech" },
        { id: "l4", imageUrl: "", alt: "Umbrella" },
        { id: "l5", imageUrl: "", alt: "Hooli" },
      ],
    }),
  },
];

/* ─────────────────────────────────────────────────────────────────── */
/*  CAROUSEL (2)                                                      */
/* ─────────────────────────────────────────────────────────────────── */

const CAROUSEL: BlockDef[] = [
  {
    id: "carousel-products",
    category: "carousel",
    label: "Carrossel de imagens",
    description: "Slider clássico — 3 slides por viewport",
    type: "carousel",
    previewClass: "bg-gradient-to-r from-blue-200 via-indigo-200 to-purple-200",
    previewLines: [{ width: "92%", align: "center", opacity: 0.5 }],
    build: () => ({
      slides: [
        { id: "s1", imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80", caption: "Produto 1" },
        { id: "s2", imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&q=80", caption: "Produto 2" },
        { id: "s3", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80", caption: "Produto 3" },
        { id: "s4", imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80", caption: "Produto 4" },
      ],
      slidesPerView: 3,
      autoplay: false,
    }),
  },
  {
    id: "carousel-screenshots",
    category: "carousel",
    label: "Carrossel de prints (stories)",
    description: "Slides verticais 9:16 pra mostrar capturas de tela",
    type: "carousel",
    previewClass: "bg-gradient-to-br from-pink-300 via-purple-300 to-indigo-300",
    previewLines: [{ width: "60%", align: "center", opacity: 0.6 }],
    build: () => ({
      slides: [
        { id: "s1", imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=300&h=600&fit=crop&q=80", caption: "" },
        { id: "s2", imageUrl: "https://images.unsplash.com/photo-1573497019418-b400bb3ab074?w=300&h=600&fit=crop&q=80", caption: "" },
        { id: "s3", imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=600&fit=crop&q=80", caption: "" },
        { id: "s4", imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=600&fit=crop&q=80", caption: "" },
      ],
      slidesPerView: 4,
      autoplay: true,
      autoplayInterval: 4000,
    }),
  },
];

/* ─────────────────────────────────────────────────────────────────── */
/*  Index combinado + helpers                                         */
/* ─────────────────────────────────────────────────────────────────── */

export const BLOCK_LIBRARY: BlockDef[] = [
  ...HERO,
  ...TESTIMONIALS,
  ...FEATURES,
  ...PRICING,
  ...FAQ,
  ...CTA,
  ...NAVBAR,
  ...FOOTER,
  ...STATS,
  ...LOGOS,
  ...CAROUSEL,
];

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  hero: "Hero",
  testimonials: "Depoimentos",
  features: "Cards / Features",
  pricing: "Planos / Pricing",
  faq: "Perguntas frequentes",
  cta: "Call to Action",
  navbar: "Navbar / Cabeçalho",
  footer: "Footer / Rodapé",
  stats: "Estatísticas / Números",
  logos: "Logos parceiros",
  carousel: "Carrosséis",
};

export const CATEGORY_ORDER: BlockCategory[] = [
  "hero",
  "testimonials",
  "features",
  "stats",
  "pricing",
  "faq",
  "cta",
  "navbar",
  "footer",
  "logos",
  "carousel",
];

export function getBlocksByCategory(category: BlockCategory | "all"): BlockDef[] {
  if (category === "all") return BLOCK_LIBRARY;
  return BLOCK_LIBRARY.filter((block) => block.category === category);
}
