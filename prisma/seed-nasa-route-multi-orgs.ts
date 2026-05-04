/**
 * Seed MULTI-EMPRESAS — NASA Route
 *
 * Popula 6 organizações criadoras de nichos diferentes (programação, saúde,
 * finanças, culinária, idiomas, marketing) cada uma com 2–4 cursos variando
 * preço (gratuito, baixo, alto), nível, formato (course/training/mentoring),
 * planos múltiplos e mix de módulos + aulas soltas.
 *
 * Objetivo: ver a área de cursos visualmente populada para validar o catálogo
 * público (`/c/<companySlug>/<courseSlug>`) e a home logada (`/nasa-route`).
 *
 * Rode com:  npx tsx prisma/seed-nasa-route-multi-orgs.ts
 *
 * 100% idempotente — usa upsert por (creatorOrgId, slug).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

// ─── Helpers ─────────────────────────────────────────────────────────────
const DEMO_PASSWORD = "senha123";

function detectVideoProvider(url: string) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
  if (yt) return { provider: "youtube", videoId: yt[1]! };
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { provider: "vimeo", videoId: vimeo[1]! };
  return { provider: null, videoId: null };
}

const cover = (id: number) => `https://picsum.photos/seed/nasa-route-${id}/1200/675`;
const avatar = (seed: string, color: string) =>
  `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}&backgroundColor=${color}`;

// Vídeos reais de YouTube/Vimeo curtos pra preencher
const VIDEO_POOL = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  "https://www.youtube.com/watch?v=9bZkp7q19f0",
  "https://www.youtube.com/watch?v=ScMzIvxBSi4",
  "https://www.youtube.com/watch?v=oHg5SJYRHA0",
  "https://vimeo.com/76979871",
  "https://vimeo.com/148751763",
  "https://vimeo.com/22439234",
];
const v = (i: number) => VIDEO_POOL[i % VIDEO_POOL.length]!;

// ─── Tipos do seed ───────────────────────────────────────────────────────
type LessonSeed = {
  title: string;
  summary?: string;
  videoUrl: string;
  isFreePreview?: boolean;
  durationMin?: number;
  awardSp?: number;
};

type ModuleSeed = {
  title: string;
  summary?: string;
  lessons: LessonSeed[];
};

type PlanSeed = {
  name: string;
  description?: string;
  priceStars: number;
  isDefault?: boolean;
  // se omitido: plano dá acesso a TODAS as aulas do curso (default)
};

type CourseSeed = {
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  coverSeed: number;
  trailerUrl?: string;
  level: "beginner" | "intermediate" | "advanced";
  format: "course" | "training" | "mentoring";
  durationMin: number;
  priceStars: number;
  rewardSpOnComplete: number;
  categorySlug: string;
  lessons?: LessonSeed[];
  modules?: ModuleSeed[];
  plans?: PlanSeed[];
};

type OrgSeed = {
  slug: string;
  name: string;
  owner: { id: string; name: string; email: string; avatarColor: string };
  courses: CourseSeed[];
};

// ─── Categorias (cobrindo todos os nichos) ──────────────────────────────
const CATEGORIES = [
  { slug: "marketing",     name: "Marketing & Aquisição",   description: "Tráfego, copy, funis e geração de leads.",       iconKey: "megaphone",      order: 0 },
  { slug: "vendas",        name: "Vendas & Conversão",       description: "Venda consultiva, follow-up e fechamento.",      iconKey: "trending-up",    order: 1 },
  { slug: "produto",       name: "Produto & Operações",      description: "Construção e operação de produtos digitais.",    iconKey: "rocket",         order: 2 },
  { slug: "mentorias",     name: "Mentorias 1:1",            description: "Sessões individuais com especialistas.",         iconKey: "user-check",     order: 3 },
  { slug: "programacao",   name: "Programação & Tech",       description: "Linguagens, frameworks, arquitetura e DevOps.",  iconKey: "code",           order: 4 },
  { slug: "design",        name: "Design & UI/UX",           description: "Design de interface, branding e prototipação.",  iconKey: "palette",        order: 5 },
  { slug: "saude",         name: "Saúde & Fitness",          description: "Treinos, nutrição e performance física.",        iconKey: "heart-pulse",    order: 6 },
  { slug: "bem-estar",     name: "Bem-estar & Mindfulness",  description: "Meditação, ansiedade e qualidade de vida.",      iconKey: "sparkles",       order: 7 },
  { slug: "financas",      name: "Finanças & Investimentos", description: "Orçamento, renda fixa, ações e cripto.",         iconKey: "piggy-bank",     order: 8 },
  { slug: "culinaria",     name: "Culinária & Gastronomia",  description: "Técnicas, receitas e gestão de cozinha.",        iconKey: "chef-hat",       order: 9 },
  { slug: "idiomas",       name: "Idiomas",                  description: "Inglês, espanhol e outros idiomas estrangeiros.", iconKey: "languages",     order: 10 },
];

// ─── Empresas + Cursos ──────────────────────────────────────────────────
const ORGS: OrgSeed[] = [
  // ════════════════════════════════════════════════════════════════════
  // 1) Academia Estelar — Marketing/Vendas (mantém compat com seed-demo)
  // ════════════════════════════════════════════════════════════════════
  {
    slug: "academia-estelar",
    name: "Academia Estelar",
    owner: {
      id: "demo-creator-academia",
      name: "Estúdio Academia Estelar",
      email: "criador@academia-estelar.demo",
      avatarColor: "8b5cf6",
    },
    courses: [
      {
        slug: "vendas-consultivas-b2b",
        title: "Vendas Consultivas B2B",
        subtitle: "Do prospect frio ao contrato fechado em 30 dias",
        description:
          "Treinamento completo para SDRs e closers que vendem ticket alto. " +
          "Inclui scripts, planilhas de cadência e simulações de objeção.",
        coverSeed: 11,
        trailerUrl: v(0),
        level: "intermediate",
        format: "training",
        durationMin: 180,
        priceStars: 480,
        rewardSpOnComplete: 200,
        categorySlug: "vendas",
        plans: [
          { name: "Acesso Completo", description: "Curso + planilhas + comunidade", priceStars: 480, isDefault: true },
          { name: "Mentoria 1:1",    description: "Tudo do completo + 4 sessões 1:1 com o instrutor", priceStars: 1500 },
        ],
        modules: [
          {
            title: "Prospecção que converte",
            summary: "Como achar e abordar o decisor sem queimar lead.",
            lessons: [
              { title: "Mapeando o ICP perfeito",            videoUrl: v(0), isFreePreview: true,  durationMin: 14, awardSp: 12 },
              { title: "Scripts de cold call que funcionam", videoUrl: v(1), isFreePreview: false, durationMin: 18, awardSp: 15 },
              { title: "Cadência multicanal em 12 toques",   videoUrl: v(2), isFreePreview: false, durationMin: 22, awardSp: 18 },
            ],
          },
          {
            title: "Diagnóstico e proposta",
            lessons: [
              { title: "SPIN Selling na prática",      videoUrl: v(3), durationMin: 24, awardSp: 18 },
              { title: "Construindo proposta vencedora", videoUrl: v(4), durationMin: 20, awardSp: 15 },
              { title: "Negociação sem perder margem", videoUrl: v(5), durationMin: 26, awardSp: 20 },
            ],
          },
        ],
      },
      {
        slug: "intro-marketing-digital",
        title: "Introdução ao Marketing Digital",
        subtitle: "Comece do zero — 100% gratuito",
        description:
          "Visão geral dos principais canais (SEO, Ads, Email, Social) e como " +
          "escolher onde focar. Ideal para quem está começando.",
        coverSeed: 12,
        level: "beginner",
        format: "course",
        durationMin: 60,
        priceStars: 0,
        rewardSpOnComplete: 80,
        categorySlug: "marketing",
        lessons: [
          { title: "Os 4 pilares do marketing digital", videoUrl: v(0), isFreePreview: true, durationMin: 8,  awardSp: 8 },
          { title: "SEO básico em 10 minutos",           videoUrl: v(1), isFreePreview: true, durationMin: 12, awardSp: 10 },
          { title: "Tráfego pago: por onde começar",     videoUrl: v(2), durationMin: 14, awardSp: 10 },
          { title: "Email marketing essencial",          videoUrl: v(3), durationMin: 13, awardSp: 10 },
          { title: "Métricas que importam",              videoUrl: v(4), durationMin: 13, awardSp: 12 },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  // 2) CodeLab — Programação
  // ════════════════════════════════════════════════════════════════════
  {
    slug: "codelab",
    name: "CodeLab",
    owner: {
      id: "demo-creator-codelab",
      name: "Mariana Dev",
      email: "mariana@codelab.demo",
      avatarColor: "06b6d4",
    },
    courses: [
      {
        slug: "react-do-zero-ao-deploy",
        title: "React do Zero ao Deploy",
        subtitle: "Construa 3 apps reais e publique no Vercel",
        description:
          "Curso prático: você sai com 3 projetos no GitHub (todo-list, " +
          "dashboard e e-commerce básico) e tudo deployed.",
        coverSeed: 21,
        trailerUrl: v(1),
        level: "beginner",
        format: "course",
        durationMin: 240,
        priceStars: 350,
        rewardSpOnComplete: 250,
        categorySlug: "programacao",
        modules: [
          {
            title: "Fundamentos de React",
            lessons: [
              { title: "Componentes e props",          videoUrl: v(0), isFreePreview: true,  durationMin: 18, awardSp: 12 },
              { title: "Estado com useState",          videoUrl: v(1), isFreePreview: true,  durationMin: 22, awardSp: 14 },
              { title: "Efeitos com useEffect",        videoUrl: v(2), durationMin: 24, awardSp: 16 },
              { title: "Lifting state up",             videoUrl: v(3), durationMin: 20, awardSp: 14 },
            ],
          },
          {
            title: "Projetos práticos",
            lessons: [
              { title: "App 1 — Todo list completo",   videoUrl: v(4), durationMin: 35, awardSp: 25 },
              { title: "App 2 — Dashboard com gráficos", videoUrl: v(5), durationMin: 40, awardSp: 30 },
              { title: "App 3 — E-commerce básico",    videoUrl: v(6), durationMin: 45, awardSp: 35 },
              { title: "Deploy no Vercel",             videoUrl: v(7), durationMin: 16, awardSp: 12 },
            ],
          },
        ],
      },
      {
        slug: "typescript-pro",
        title: "TypeScript Pro",
        subtitle: "Generics, utility types e padrões avançados",
        description:
          "Para devs que já usam TypeScript no básico e querem dominar " +
          "tipos avançados, generics e patterns de bibliotecas como tRPC e Zod.",
        coverSeed: 22,
        trailerUrl: v(2),
        level: "advanced",
        format: "course",
        durationMin: 180,
        priceStars: 600,
        rewardSpOnComplete: 300,
        categorySlug: "programacao",
        lessons: [
          { title: "Recap de tipos fundamentais",  videoUrl: v(0), isFreePreview: true, durationMin: 18, awardSp: 12 },
          { title: "Generics aplicados",            videoUrl: v(1), durationMin: 28, awardSp: 18 },
          { title: "Conditional types",             videoUrl: v(2), durationMin: 26, awardSp: 18 },
          { title: "Utility types na prática",      videoUrl: v(3), durationMin: 30, awardSp: 20 },
          { title: "Inferência avançada",           videoUrl: v(4), durationMin: 24, awardSp: 18 },
          { title: "Building Zod-like libraries",   videoUrl: v(5), durationMin: 32, awardSp: 24 },
        ],
      },
      {
        slug: "mentoria-arquitetura-fullstack",
        title: "Mentoria 1:1 — Arquitetura Fullstack",
        subtitle: "4 sessões de 1h com revisão do seu projeto real",
        description:
          "Mentoria individual focada em revisar a arquitetura do seu produto: " +
          "frontend, backend, banco e deploy. Você sai com um plano de evolução.",
        coverSeed: 23,
        level: "advanced",
        format: "mentoring",
        durationMin: 240,
        priceStars: 1800,
        rewardSpOnComplete: 400,
        categorySlug: "mentorias",
        lessons: [
          { title: "Como funciona a mentoria", videoUrl: v(0), isFreePreview: true, durationMin: 5, awardSp: 5 },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  // 3) Saúde Total — Fitness/Nutrição
  // ════════════════════════════════════════════════════════════════════
  {
    slug: "saude-total",
    name: "Saúde Total",
    owner: {
      id: "demo-creator-saude",
      name: "Dr. Ricardo Atletismo",
      email: "ricardo@saude-total.demo",
      avatarColor: "10b981",
    },
    courses: [
      {
        slug: "treino-em-casa-30-dias",
        title: "Treino em Casa — Programa de 30 dias",
        subtitle: "Sem equipamento, 25 min/dia, resultados visíveis",
        description:
          "Plano completo de 30 dias com treinos progressivos para quem não " +
          "tem academia. Inclui plano alimentar simples e PDF imprimível.",
        coverSeed: 31,
        trailerUrl: v(3),
        level: "beginner",
        format: "training",
        durationMin: 750,
        priceStars: 250,
        rewardSpOnComplete: 200,
        categorySlug: "saude",
        plans: [
          { name: "Programa básico",   description: "Acesso a todas as aulas + plano alimentar", priceStars: 250, isDefault: true },
          { name: "Programa + Coach",  description: "Programa básico + 2 sessões individuais por WhatsApp", priceStars: 700 },
        ],
        modules: [
          {
            title: "Semana 1 — Adaptação",
            lessons: [
              { title: "Avaliação inicial e mindset",  videoUrl: v(0), isFreePreview: true, durationMin: 12, awardSp: 8 },
              { title: "Treino A — Membros inferiores", videoUrl: v(1), durationMin: 25, awardSp: 15 },
              { title: "Treino B — Membros superiores", videoUrl: v(2), durationMin: 25, awardSp: 15 },
              { title: "Treino C — Core e cardio",      videoUrl: v(3), durationMin: 25, awardSp: 15 },
            ],
          },
          {
            title: "Semana 2 — Intensificação",
            lessons: [
              { title: "Treino D — Funcional pesado", videoUrl: v(4), durationMin: 30, awardSp: 18 },
              { title: "Treino E — HIIT em casa",     videoUrl: v(5), durationMin: 25, awardSp: 18 },
              { title: "Mobilidade ativa",            videoUrl: v(6), durationMin: 20, awardSp: 12 },
            ],
          },
          {
            title: "Semanas 3 e 4 — Performance",
            lessons: [
              { title: "Construção de força",          videoUrl: v(7), durationMin: 32, awardSp: 20 },
              { title: "Cardio metabólico avançado",   videoUrl: v(0), durationMin: 28, awardSp: 18 },
              { title: "Avaliação final + próximos passos", videoUrl: v(1), durationMin: 14, awardSp: 12 },
            ],
          },
        ],
      },
      {
        slug: "nutricao-pratica",
        title: "Nutrição Prática para o dia a dia",
        subtitle: "Como montar pratos saudáveis sem virar nutricionista",
        description:
          "Curso direto ao ponto: montagem de pratos, leitura de rótulos, " +
          "compras inteligentes e meal prep semanal.",
        coverSeed: 32,
        level: "beginner",
        format: "course",
        durationMin: 90,
        priceStars: 180,
        rewardSpOnComplete: 120,
        categorySlug: "saude",
        lessons: [
          { title: "Os 3 macronutrientes em 5 min", videoUrl: v(0), isFreePreview: true, durationMin: 6,  awardSp: 8 },
          { title: "Como ler rótulos sem cair em armadilhas", videoUrl: v(1), durationMin: 18, awardSp: 12 },
          { title: "Compras semanais inteligentes",  videoUrl: v(2), durationMin: 22, awardSp: 14 },
          { title: "Meal prep para a semana toda",   videoUrl: v(3), durationMin: 24, awardSp: 16 },
          { title: "Snacks saudáveis e baratos",     videoUrl: v(4), durationMin: 20, awardSp: 14 },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  // 4) Bolso Cheio — Finanças
  // ════════════════════════════════════════════════════════════════════
  {
    slug: "bolso-cheio",
    name: "Bolso Cheio",
    owner: {
      id: "demo-creator-bolso",
      name: "Camila Investe",
      email: "camila@bolso-cheio.demo",
      avatarColor: "f59e0b",
    },
    courses: [
      {
        slug: "primeiros-investimentos",
        title: "Primeiros Investimentos",
        subtitle: "Sair da poupança em 30 dias — gratuito",
        description:
          "Aprenda a investir do zero: Tesouro Direto, CDBs, fundos. " +
          "Sem firula, sem promessas malucas, só o essencial.",
        coverSeed: 41,
        trailerUrl: v(4),
        level: "beginner",
        format: "course",
        durationMin: 80,
        priceStars: 0,
        rewardSpOnComplete: 100,
        categorySlug: "financas",
        lessons: [
          { title: "Por que sair da poupança",      videoUrl: v(0), isFreePreview: true, durationMin: 10, awardSp: 10 },
          { title: "Como abrir conta na corretora",  videoUrl: v(1), isFreePreview: true, durationMin: 12, awardSp: 10 },
          { title: "Tesouro Direto explicado",       videoUrl: v(2), durationMin: 16, awardSp: 12 },
          { title: "CDB, LCI e LCA",                  videoUrl: v(3), durationMin: 18, awardSp: 12 },
          { title: "Sua primeira aplicação",          videoUrl: v(4), durationMin: 14, awardSp: 14 },
        ],
      },
      {
        slug: "investidor-inteligente",
        title: "Investidor Inteligente — Renda Variável",
        subtitle: "Ações, FIIs e construção de carteira",
        description:
          "Para quem já saiu da renda fixa: análise fundamentalista, " +
          "FIIs, dividend yield e como montar uma carteira balanceada.",
        coverSeed: 42,
        trailerUrl: v(5),
        level: "intermediate",
        format: "course",
        durationMin: 200,
        priceStars: 550,
        rewardSpOnComplete: 250,
        categorySlug: "financas",
        plans: [
          { name: "Curso completo",      description: "Acesso a todas as aulas + planilhas", priceStars: 550, isDefault: true },
          { name: "Curso + Comunidade",  description: "Inclui acesso vitalício à comunidade Discord", priceStars: 900 },
        ],
        modules: [
          {
            title: "Análise fundamentalista",
            lessons: [
              { title: "Lendo um balanço sem medo",     videoUrl: v(0), isFreePreview: true, durationMin: 25, awardSp: 18 },
              { title: "Indicadores que importam (P/L, ROE, DY)", videoUrl: v(1), durationMin: 28, awardSp: 20 },
              { title: "Cases reais: 3 ações analisadas",  videoUrl: v(2), durationMin: 32, awardSp: 22 },
            ],
          },
          {
            title: "FIIs e renda passiva",
            lessons: [
              { title: "Tipos de FIIs explicados",      videoUrl: v(3), durationMin: 22, awardSp: 16 },
              { title: "Calculando dividend yield real", videoUrl: v(4), durationMin: 18, awardSp: 14 },
              { title: "Montando carteira de FIIs",     videoUrl: v(5), durationMin: 26, awardSp: 20 },
            ],
          },
          {
            title: "Carteira balanceada",
            lessons: [
              { title: "Diversificação na prática",     videoUrl: v(6), durationMin: 24, awardSp: 18 },
              { title: "Rebalanceamento trimestral",    videoUrl: v(7), durationMin: 25, awardSp: 20 },
            ],
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  // 5) Cozinha Real — Culinária
  // ════════════════════════════════════════════════════════════════════
  {
    slug: "cozinha-real",
    name: "Cozinha Real",
    owner: {
      id: "demo-creator-cozinha",
      name: "Chef André Forno",
      email: "andre@cozinha-real.demo",
      avatarColor: "ef4444",
    },
    courses: [
      {
        slug: "tecnicas-de-faca",
        title: "Técnicas de Faca para Iniciantes",
        subtitle: "Cortes profissionais em 1 hora",
        description:
          "Domine os cortes básicos: julienne, brunoise, chiffonade. " +
          "Aulas curtas, demonstrativas e com erros comuns explicados.",
        coverSeed: 51,
        trailerUrl: v(6),
        level: "beginner",
        format: "course",
        durationMin: 60,
        priceStars: 120,
        rewardSpOnComplete: 80,
        categorySlug: "culinaria",
        lessons: [
          { title: "Escolhendo a faca certa",  videoUrl: v(0), isFreePreview: true, durationMin: 8,  awardSp: 8 },
          { title: "Pegada e postura segura",   videoUrl: v(1), isFreePreview: true, durationMin: 10, awardSp: 10 },
          { title: "Corte julienne",             videoUrl: v(2), durationMin: 12, awardSp: 12 },
          { title: "Corte brunoise",             videoUrl: v(3), durationMin: 12, awardSp: 12 },
          { title: "Chiffonade e mirepoix",      videoUrl: v(4), durationMin: 14, awardSp: 14 },
        ],
      },
      {
        slug: "massas-italianas",
        title: "Massas Italianas Caseiras",
        subtitle: "Do macarrão fresco aos molhos clássicos",
        description:
          "Curso completo: faça macarrão do zero, prepare 5 molhos clássicos " +
          "(carbonara, ragu, pesto, alfredo, pomodoro) e monte um jantar memorável.",
        coverSeed: 52,
        trailerUrl: v(7),
        level: "intermediate",
        format: "course",
        durationMin: 150,
        priceStars: 320,
        rewardSpOnComplete: 180,
        categorySlug: "culinaria",
        modules: [
          {
            title: "Massas frescas",
            lessons: [
              { title: "Massa básica de ovo",        videoUrl: v(0), isFreePreview: true, durationMin: 18, awardSp: 14 },
              { title: "Tagliatelle e fettuccine",   videoUrl: v(1), durationMin: 22, awardSp: 16 },
              { title: "Ravioli recheado",           videoUrl: v(2), durationMin: 28, awardSp: 20 },
            ],
          },
          {
            title: "Molhos clássicos",
            lessons: [
              { title: "Carbonara autêntica (sem creme!)", videoUrl: v(3), durationMin: 16, awardSp: 14 },
              { title: "Ragu napolitano de 4h",      videoUrl: v(4), durationMin: 24, awardSp: 18 },
              { title: "Pesto genovese no pilão",    videoUrl: v(5), durationMin: 14, awardSp: 12 },
              { title: "Pomodoro perfeito",          videoUrl: v(6), durationMin: 12, awardSp: 12 },
              { title: "Alfredo cremoso",            videoUrl: v(7), durationMin: 16, awardSp: 14 },
            ],
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════
  // 6) Fluentes — Idiomas
  // ════════════════════════════════════════════════════════════════════
  {
    slug: "fluentes",
    name: "Fluentes",
    owner: {
      id: "demo-creator-fluentes",
      name: "Prof. Júlia Linguagens",
      email: "julia@fluentes.demo",
      avatarColor: "ec4899",
    },
    courses: [
      {
        slug: "ingles-zero-conversa",
        title: "Inglês do Zero à Conversa",
        subtitle: "12 semanas para destravar de vez",
        description:
          "Método focado em conversação real, sem decorar regras. " +
          "Você conversa do dia 1 e ganha confiança em situações reais.",
        coverSeed: 61,
        trailerUrl: v(0),
        level: "beginner",
        format: "course",
        durationMin: 360,
        priceStars: 420,
        rewardSpOnComplete: 220,
        categorySlug: "idiomas",
        plans: [
          { name: "Curso solo",        description: "Acesso a todas as aulas + materiais",      priceStars: 420, isDefault: true },
          { name: "Curso + Conversa",  description: "Tudo do solo + 4 sessões em grupo ao vivo", priceStars: 950 },
        ],
        modules: [
          {
            title: "Sobrevivência",
            lessons: [
              { title: "Apresentação e small talk",  videoUrl: v(0), isFreePreview: true, durationMin: 18, awardSp: 14 },
              { title: "Pedir comida e direções",     videoUrl: v(1), durationMin: 22, awardSp: 16 },
              { title: "Números, horas e datas",      videoUrl: v(2), durationMin: 20, awardSp: 14 },
            ],
          },
          {
            title: "Trabalho",
            lessons: [
              { title: "Reuniões e conf calls",       videoUrl: v(3), durationMin: 26, awardSp: 18 },
              { title: "Emails formais e informais",  videoUrl: v(4), durationMin: 22, awardSp: 16 },
              { title: "Apresentações em inglês",     videoUrl: v(5), durationMin: 28, awardSp: 20 },
            ],
          },
          {
            title: "Viagens",
            lessons: [
              { title: "Aeroporto sem stress",         videoUrl: v(6), durationMin: 20, awardSp: 14 },
              { title: "Hotel, hostel e Airbnb",       videoUrl: v(7), durationMin: 22, awardSp: 16 },
              { title: "Conversando com locais",       videoUrl: v(0), durationMin: 24, awardSp: 18 },
            ],
          },
        ],
      },
      {
        slug: "espanhol-em-30-dias",
        title: "Espanhol em 30 Dias",
        subtitle: "Curso intensivo para viagem ou trabalho",
        description:
          "Programa intensivo: 30 aulas curtas, uma por dia, focado em " +
          "comunicação prática para quem precisa rápido.",
        coverSeed: 62,
        level: "beginner",
        format: "training",
        durationMin: 300,
        priceStars: 280,
        rewardSpOnComplete: 180,
        categorySlug: "idiomas",
        lessons: [
          { title: "Pronúncia e cumprimentos",  videoUrl: v(0), isFreePreview: true, durationMin: 15, awardSp: 12 },
          { title: "Apresentação pessoal",       videoUrl: v(1), isFreePreview: true, durationMin: 12, awardSp: 10 },
          { title: "Verbos essenciais",          videoUrl: v(2), durationMin: 20, awardSp: 14 },
          { title: "Restaurante e compras",      videoUrl: v(3), durationMin: 18, awardSp: 14 },
          { title: "Viagem e turismo",           videoUrl: v(4), durationMin: 22, awardSp: 16 },
          { title: "Trabalho e reuniões",        videoUrl: v(5), durationMin: 24, awardSp: 16 },
        ],
      },
    ],
  },
];

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Seed multi-empresas — iniciando…\n");

  // 1) Categorias
  for (const c of CATEGORIES) {
    await prisma.nasaRouteCategory.upsert({
      where:  { slug: c.slug },
      create: c,
      update: { name: c.name, description: c.description, iconKey: c.iconKey, order: c.order },
    });
  }
  console.log(`✓ ${CATEGORIES.length} categorias\n`);

  const pwHash = await hashPassword(DEMO_PASSWORD);
  let totalCourses = 0;
  let totalLessons = 0;
  let totalPlans   = 0;

  for (const orgSeed of ORGS) {
    // 2) Owner user
    const user = await prisma.user.upsert({
      where:  { email: orgSeed.owner.email },
      create: {
        id:            orgSeed.owner.id,
        name:          orgSeed.owner.name,
        email:         orgSeed.owner.email,
        emailVerified: true,
        image:         avatar(orgSeed.slug, orgSeed.owner.avatarColor),
        isActive:      true,
      },
      update: {
        name:  orgSeed.owner.name,
        image: avatar(orgSeed.slug, orgSeed.owner.avatarColor),
      },
    });

    await prisma.account.upsert({
      where:  { id: `account-${user.id}` },
      create: {
        id:         `account-${user.id}`,
        accountId:  user.email,
        providerId: "credential",
        userId:     user.id,
        password:   pwHash,
        createdAt:  new Date(),
        updatedAt:  new Date(),
      },
      update: { password: pwHash },
    });

    // 3) Organização
    const org = await prisma.organization.upsert({
      where:  { slug: orgSeed.slug },
      create: {
        id:        `org-${orgSeed.slug}`,
        name:      orgSeed.name,
        slug:      orgSeed.slug,
        createdAt: new Date(),
      },
      update: { name: orgSeed.name },
    });

    await prisma.member.upsert({
      where:  { userId_organizationId: { userId: user.id, organizationId: org.id } },
      create: {
        id:             `member-${user.id}-${org.id}`,
        organizationId: org.id,
        userId:         user.id,
        role:           "owner",
        createdAt:      new Date(),
      },
      update: { role: "owner" },
    });

    console.log(`▸ ${orgSeed.name} (/c/${orgSeed.slug}) — ${orgSeed.courses.length} cursos`);

    // 4) Cursos
    for (const c of orgSeed.courses) {
      const cat = await prisma.nasaRouteCategory.findUnique({ where: { slug: c.categorySlug } });

      const course = await prisma.nasaRouteCourse.upsert({
        where: { creatorOrgId_slug: { creatorOrgId: org.id, slug: c.slug } },
        create: {
          slug:               c.slug,
          title:              c.title,
          subtitle:           c.subtitle,
          description:        c.description,
          coverUrl:           cover(c.coverSeed),
          trailerUrl:         c.trailerUrl,
          level:              c.level,
          format:             c.format,
          durationMin:        c.durationMin,
          priceStars:         c.priceStars,
          rewardSpOnComplete: c.rewardSpOnComplete,
          creatorOrgId:       org.id,
          creatorUserId:      user.id,
          categoryId:         cat?.id,
          isPublished:        true,
          publishedAt:        new Date(),
        },
        update: {
          title:              c.title,
          subtitle:           c.subtitle,
          description:        c.description,
          coverUrl:           cover(c.coverSeed),
          trailerUrl:         c.trailerUrl,
          level:              c.level,
          format:             c.format,
          durationMin:        c.durationMin,
          priceStars:         c.priceStars,
          rewardSpOnComplete: c.rewardSpOnComplete,
          categoryId:         cat?.id,
          isPublished:        true,
        },
      });

      // Reset aulas, módulos e planos pra reseed limpo
      await prisma.nasaRouteLesson.deleteMany({ where: { courseId: course.id } });
      await prisma.nasaRouteModule.deleteMany({ where: { courseId: course.id } });
      await prisma.nasaRoutePlan.deleteMany({   where: { courseId: course.id } });

      let order = 0;

      // 4a) Aulas soltas
      for (const l of c.lessons ?? []) {
        const { provider, videoId } = detectVideoProvider(l.videoUrl);
        await prisma.nasaRouteLesson.create({
          data: {
            courseId:      course.id,
            moduleId:      null,
            order:         order++,
            title:         l.title,
            summary:       l.summary,
            videoUrl:      l.videoUrl,
            videoProvider: provider,
            videoId,
            durationMin:   l.durationMin,
            isFreePreview: l.isFreePreview ?? false,
            awardSp:       l.awardSp ?? 10,
          },
        });
        totalLessons++;
      }

      // 4b) Módulos + aulas
      let moduleOrder = 0;
      for (const m of c.modules ?? []) {
        const mod = await prisma.nasaRouteModule.create({
          data: {
            courseId: course.id,
            order:    moduleOrder++,
            title:    m.title,
            summary:  m.summary,
          },
        });

        for (const l of m.lessons) {
          const { provider, videoId } = detectVideoProvider(l.videoUrl);
          await prisma.nasaRouteLesson.create({
            data: {
              courseId:      course.id,
              moduleId:      mod.id,
              order:         order++,
              title:         l.title,
              summary:       l.summary,
              videoUrl:      l.videoUrl,
              videoProvider: provider,
              videoId,
              durationMin:   l.durationMin,
              isFreePreview: l.isFreePreview ?? false,
              awardSp:       l.awardSp ?? 10,
            },
          });
          totalLessons++;
        }
      }

      // 4c) Planos (se definidos)
      if (c.plans?.length) {
        let planOrder = 0;
        const allLessons = await prisma.nasaRouteLesson.findMany({
          where: { courseId: course.id },
          select: { id: true },
        });
        for (const p of c.plans) {
          const plan = await prisma.nasaRoutePlan.create({
            data: {
              courseId:    course.id,
              name:        p.name,
              description: p.description,
              priceStars:  p.priceStars,
              order:       planOrder++,
              isDefault:   p.isDefault ?? false,
            },
          });
          // Cada plano dá acesso a todas as aulas (modelo simplificado do seed)
          if (allLessons.length) {
            await prisma.nasaRoutePlanLesson.createMany({
              data: allLessons.map((l) => ({ planId: plan.id, lessonId: l.id })),
            });
          }
          totalPlans++;
        }
      }

      totalCourses++;
    }
  }

  console.log(
    `\n🎉 Seed concluído: ${ORGS.length} empresas · ${totalCourses} cursos · ` +
    `${totalLessons} aulas · ${totalPlans} planos`,
  );
  console.log(`   Senha de todos os criadores: ${DEMO_PASSWORD}`);
  console.log(`\n   Páginas públicas:`);
  for (const o of ORGS) {
    for (const c of o.courses) {
      console.log(`   • /c/${o.slug}/${c.slug}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
