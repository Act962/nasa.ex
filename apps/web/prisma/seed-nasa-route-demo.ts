/**
 * Seed de DEMONSTRAÇÃO — NASA Route
 *
 * Popula categorias, 1 user criador, 1 organização criadora e 2 cursos
 * exemplo (1 gratuito, 1 pago em STARs) com módulo opcional, mix de aulas
 * YouTube/Vimeo e algumas aulas marcadas como `isFreePreview` para validar
 * o catálogo público e o player de preview.
 *
 * Rode com:  npx tsx prisma/seed-nasa-route-demo.ts
 *
 * 100% idempotente — usa upsert por slug.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

// ─── Constantes do criador demo ──────────────────────────────────────────
const DEMO_PASSWORD = "senha123";

const DEMO_CREATOR_USER = {
  id: "demo-nasa-route-creator",
  name: "Estúdio NASA Route Demo",
  email: "criador@nasaroute.demo",
  image:
    "https://api.dicebear.com/9.x/pixel-art/svg?seed=nasaroute&backgroundColor=8b5cf6",
};

const DEMO_CREATOR_ORG = {
  id: "demo-nasa-route-creator-org",
  name: "Academia Estelar",
  slug: "academia-estelar",
};

// ─── Categorias ──────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    slug: "marketing",
    name: "Marketing & Aquisição",
    description: "Cursos sobre tráfego, copy, funis e geração de leads.",
    iconKey: "megaphone",
    order: 0,
  },
  {
    slug: "vendas",
    name: "Vendas & Conversão",
    description: "Técnicas de venda consultiva, follow-up e fechamento.",
    iconKey: "trending-up",
    order: 1,
  },
  {
    slug: "produto",
    name: "Produto & Operações",
    description: "Construção, gestão e operação de produtos digitais.",
    iconKey: "rocket",
    order: 2,
  },
  {
    slug: "mentorias",
    name: "Mentorias 1:1",
    description: "Sessões individuais com especialistas da plataforma.",
    iconKey: "user-check",
    order: 3,
  },
];

// ─── Cursos ──────────────────────────────────────────────────────────────
type LessonSeed = {
  title: string;
  summary?: string;
  videoUrl: string;
  isFreePreview?: boolean;
  durationMin?: number;
  awardSp?: number;
};

type ModuleSeed = {
  slug: string;
  title: string;
  summary?: string;
  lessons: LessonSeed[];
};

type CourseSeed = {
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  coverUrl?: string;
  trailerUrl?: string;
  level: "beginner" | "intermediate" | "advanced";
  format: "course" | "training" | "mentoring";
  durationMin: number;
  priceStars: number;
  rewardSpOnComplete: number;
  categorySlug: string;
  lessons?: LessonSeed[]; // aulas soltas (sem módulo)
  modules?: ModuleSeed[]; // módulos opcionais
};

const COURSES: CourseSeed[] = [
  {
    slug: "introducao-nasa-route",
    title: "Introdução ao NASA Route",
    subtitle: "Comece de graça e entenda como vender cursos com STARs",
    description:
      "Um tour rápido pela plataforma NASA Route: como funcionam STARs, " +
      "Space Points, criação de cursos e a área de membros. Curso 100% gratuito.",
    coverUrl: undefined,
    trailerUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    level: "beginner",
    format: "course",
    durationMin: 25,
    priceStars: 0,
    rewardSpOnComplete: 50,
    categorySlug: "produto",
    lessons: [
      {
        title: "Bem-vindo ao NASA Route",
        summary: "Visão geral da área de membros e do que você vai aprender.",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        isFreePreview: true,
        durationMin: 5,
        awardSp: 5,
      },
      {
        title: "Como funcionam as STARs",
        summary: "A moeda interna que o aluno usa para comprar cursos.",
        videoUrl: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
        isFreePreview: true,
        durationMin: 8,
        awardSp: 10,
      },
      {
        title: "Space Points e níveis",
        summary: "Como cada aula concluída faz o aluno subir de nível.",
        videoUrl: "https://vimeo.com/76979871",
        isFreePreview: true,
        durationMin: 6,
        awardSp: 10,
      },
      {
        title: "Criando seu primeiro curso",
        summary: "Passo a passo para publicar um curso na sua organização.",
        videoUrl: "https://www.youtube.com/watch?v=ScMzIvxBSi4",
        isFreePreview: false,
        durationMin: 6,
        awardSp: 15,
      },
    ],
  },
  {
    slug: "vendas-com-stars",
    title: "Vendas com STARs — do tráfego ao fechamento",
    subtitle: "Treinamento avançado com playbooks de conversão",
    description:
      "Treinamento completo para criadores que querem escalar a área de " +
      "membros usando STARs como combustível. Inclui playbooks de tráfego, " +
      "follow-up automatizado e fechamento de tickets altos.",
    coverUrl: undefined,
    trailerUrl: "https://vimeo.com/22439234",
    level: "intermediate",
    format: "training",
    durationMin: 95,
    priceStars: 500,
    rewardSpOnComplete: 200,
    categorySlug: "vendas",
    modules: [
      {
        slug: "fundamentos",
        title: "Fundamentos de Aquisição",
        summary: "Tráfego, oferta e copy: as três engrenagens da aquisição.",
        lessons: [
          {
            title: "Anatomia de uma oferta irresistível",
            summary: "Estrutura, gatilhos e ancoragem de preço.",
            videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
            isFreePreview: true,
            durationMin: 18,
            awardSp: 15,
          },
          {
            title: "Funis de tráfego pago para STARs",
            summary: "Da campanha ao checkout, como mapear o caminho do aluno.",
            videoUrl: "https://www.youtube.com/watch?v=9bZkp7q19f0",
            isFreePreview: false,
            durationMin: 22,
            awardSp: 20,
          },
        ],
      },
      {
        slug: "follow-up-fechamento",
        title: "Follow-up e Fechamento",
        summary: "Sequências, objeções e fechamento humanizado.",
        lessons: [
          {
            title: "Sequência de aquecimento em 7 passos",
            summary: "Cada mensagem com seu objetivo claro.",
            videoUrl: "https://vimeo.com/148751763",
            isFreePreview: false,
            durationMin: 16,
            awardSp: 15,
          },
          {
            title: "Quebrando as 5 objeções universais",
            summary: "Preço, tempo, confiança, prova social e urgência.",
            videoUrl: "https://vimeo.com/76979871",
            isFreePreview: false,
            durationMin: 19,
            awardSp: 15,
          },
          {
            title: "Fechamento por DM e por WhatsApp",
            summary: "Roteiros prontos para os dois canais.",
            videoUrl: "https://www.youtube.com/watch?v=ScMzIvxBSi4",
            isFreePreview: false,
            durationMin: 20,
            awardSp: 20,
          },
        ],
      },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────
function detectVideoProvider(url: string): {
  provider: string | null;
  videoId: string | null;
} {
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/,
  );
  if (yt) return { provider: "youtube", videoId: yt[1]! };

  const vimeo =
    url.match(/vimeo\.com\/(?:video\/)?(\d+)/) ??
    url.match(/player\.vimeo\.com\/video\/(\d+)/);
  if (vimeo) return { provider: "vimeo", videoId: vimeo[1]! };

  return { provider: null, videoId: null };
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Seed NASA Route — iniciando…");

  // 1) Criador demo (User + Account)
  const pwHash = await hashPassword(DEMO_PASSWORD);
  const creatorUser = await prisma.user.upsert({
    where: { email: DEMO_CREATOR_USER.email },
    create: {
      id: DEMO_CREATOR_USER.id,
      name: DEMO_CREATOR_USER.name,
      email: DEMO_CREATOR_USER.email,
      emailVerified: true,
      image: DEMO_CREATOR_USER.image,
      isActive: true,
    },
    update: {
      name: DEMO_CREATOR_USER.name,
      image: DEMO_CREATOR_USER.image,
    },
  });

  await prisma.account.upsert({
    where: { id: `account-${creatorUser.id}` },
    create: {
      id: `account-${creatorUser.id}`,
      accountId: creatorUser.email,
      providerId: "credential",
      userId: creatorUser.id,
      password: pwHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    update: { password: pwHash },
  });
  console.log(
    `✓ Usuário criador: ${creatorUser.email} (senha: ${DEMO_PASSWORD})`,
  );

  // 2) Organização criadora demo
  const creatorOrg = await prisma.organization.upsert({
    where: { slug: DEMO_CREATOR_ORG.slug },
    create: {
      id: DEMO_CREATOR_ORG.id,
      name: DEMO_CREATOR_ORG.name,
      slug: DEMO_CREATOR_ORG.slug,
      createdAt: new Date(),
    },
    update: { name: DEMO_CREATOR_ORG.name },
  });

  // Membership owner do criador
  await prisma.member.upsert({
    where: {
      userId_organizationId: {
        userId: creatorUser.id,
        organizationId: creatorOrg.id,
      },
    },
    create: {
      id: `member-${creatorUser.id}-${creatorOrg.id}`,
      organizationId: creatorOrg.id,
      userId: creatorUser.id,
      role: "owner",
      createdAt: new Date(),
    },
    update: { role: "owner" },
  });
  console.log(
    `✓ Organização criadora: ${creatorOrg.name} (slug: ${creatorOrg.slug})`,
  );

  // 3) Categorias
  for (const c of CATEGORIES) {
    await prisma.nasaRouteCategory.upsert({
      where: { slug: c.slug },
      create: c,
      update: {
        name: c.name,
        description: c.description,
        iconKey: c.iconKey,
        order: c.order,
      },
    });
  }
  console.log(`✓ ${CATEGORIES.length} categorias criadas.`);

  // 4) Cursos + Módulos + Aulas
  let totalLessons = 0;
  for (const c of COURSES) {
    const cat = await prisma.nasaRouteCategory.findUnique({
      where: { slug: c.categorySlug },
    });

    const course = await prisma.nasaRouteCourse.upsert({
      where: {
        creatorOrgId_slug: { creatorOrgId: creatorOrg.id, slug: c.slug },
      },
      create: {
        slug: c.slug,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        coverUrl: c.coverUrl,
        trailerUrl: c.trailerUrl,
        level: c.level,
        format: c.format,
        durationMin: c.durationMin,
        priceStars: c.priceStars,
        rewardSpOnComplete: c.rewardSpOnComplete,
        creatorOrgId: creatorOrg.id,
        creatorUserId: creatorUser.id,
        categoryId: cat?.id,
        isPublished: true,
        publishedAt: new Date(),
      },
      update: {
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        trailerUrl: c.trailerUrl,
        level: c.level,
        format: c.format,
        durationMin: c.durationMin,
        priceStars: c.priceStars,
        rewardSpOnComplete: c.rewardSpOnComplete,
        categoryId: cat?.id,
        isPublished: true,
      },
    });

    // Reset aulas e módulos para reseed limpo (cascata em FK cuida das aulas)
    await prisma.nasaRouteLesson.deleteMany({ where: { courseId: course.id } });
    await prisma.nasaRouteModule.deleteMany({ where: { courseId: course.id } });

    let order = 0;

    // 4a) Aulas soltas (sem módulo)
    for (const l of c.lessons ?? []) {
      const { provider, videoId } = detectVideoProvider(l.videoUrl);
      await prisma.nasaRouteLesson.create({
        data: {
          courseId: course.id,
          moduleId: null,
          order: order++,
          title: l.title,
          summary: l.summary,
          videoUrl: l.videoUrl,
          videoProvider: provider,
          videoId,
          durationMin: l.durationMin,
          isFreePreview: l.isFreePreview ?? false,
          awardSp: l.awardSp ?? 10,
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
          order: moduleOrder++,
          title: m.title,
          summary: m.summary,
        },
      });

      for (const l of m.lessons) {
        const { provider, videoId } = detectVideoProvider(l.videoUrl);
        await prisma.nasaRouteLesson.create({
          data: {
            courseId: course.id,
            moduleId: mod.id,
            order: order++,
            title: l.title,
            summary: l.summary,
            videoUrl: l.videoUrl,
            videoProvider: provider,
            videoId,
            durationMin: l.durationMin,
            isFreePreview: l.isFreePreview ?? false,
            awardSp: l.awardSp ?? 10,
          },
        });
        totalLessons++;
      }
    }
  }
  console.log(`✓ ${COURSES.length} cursos e ${totalLessons} aulas criadas.`);

  console.log("\n🎉 Seed NASA Route concluído.");
  console.log(`   • Criador : ${DEMO_CREATOR_USER.email} / ${DEMO_PASSWORD}`);
  console.log(`   • Org     : /c/${DEMO_CREATOR_ORG.slug}`);
  console.log(`   • Cursos  : ${COURSES.map((c) => c.slug).join(", ")}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
