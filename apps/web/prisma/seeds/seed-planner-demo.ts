/**
 * Seed — NASA Planner Demo
 * Popula o planner existente com posts variados para demonstrar o calendário,
 * editor de imagem, status badge, redes sociais, etc.
 *
 * Uso: npx tsx prisma/seeds/seed-planner-demo.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";
import { PrismaClient, NasaPlannerPostStatus } from "../../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
import dayjs from "dayjs";

const prisma = new PrismaClient({ adapter } as any);

const ORG_ID = "GHqaKGx2iD4Za5tnO8WzKbC8xUVBkPg0";
const PLANNER_ID = "cmonhb2r0000dnpxbxd9yp68y";
const CREATED_BY_ID = "oWg8TLUUfm8H963mdBllNITnmEvermcI";

// Imagens de placeholder do Unsplash (públicas)
const THUMB_URLS = [
  "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400", // social media
  "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400", // marketing
  "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400", // laptop
  "https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?w=400", // design
  "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400", // office
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400", // team
  "https://images.unsplash.com/photo-1493612276216-ee3925520721?w=400", // creative
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400", // analytics
];

type PostSeed = {
  title: string;
  caption: string;
  type: "STATIC" | "CAROUSEL" | "REEL" | "STORY";
  status: NasaPlannerPostStatus;
  networks: string[];
  offsetDays: number; // dias a partir de hoje
  thumbnail?: string;
};

const posts: PostSeed[] = [
  {
    title: "Lançamento da coleção verão 🌞",
    caption: "Apresentamos nossa nova coleção de verão! Cores vibrantes, materiais sustentáveis e designs modernos que vão transformar seu guarda-roupa. Confira em nossa loja! #verão #moda #sustentabilidade",
    type: "CAROUSEL",
    status: NasaPlannerPostStatus.PUBLISHED,
    networks: ["INSTAGRAM", "FACEBOOK"],
    offsetDays: -10,
    thumbnail: THUMB_URLS[0],
  },
  {
    title: "Dica de produtividade — segunda",
    caption: "Sabia que separar 15 minutos pela manhã para planejar o dia aumenta sua produtividade em até 40%? Experimente amanhã! ⏱️ #produtividade #dicas #trabalho",
    type: "STATIC",
    status: NasaPlannerPostStatus.PUBLISHED,
    networks: ["INSTAGRAM"],
    offsetDays: -7,
    thumbnail: THUMB_URLS[2],
  },
  {
    title: "Behind the scenes — nossa equipe",
    caption: "Um dia na vida da nossa equipe criativa! 🎬 Bastidores do próximo grande projeto. Fica ligado! #bts #equipe #criatividade",
    type: "REEL",
    status: NasaPlannerPostStatus.PUBLISHED,
    networks: ["INSTAGRAM", "TIKTOK"],
    offsetDays: -5,
    thumbnail: THUMB_URLS[5],
  },
  {
    title: "Story — Enquete semanal",
    caption: "Qual conteúdo você prefere ver de nós?",
    type: "STORY",
    status: NasaPlannerPostStatus.PUBLISHED,
    networks: ["INSTAGRAM"],
    offsetDays: -3,
    thumbnail: THUMB_URLS[6],
  },
  {
    title: "Case de sucesso — Cliente X",
    caption: "Como o Cliente X aumentou suas vendas em 300% usando nossa plataforma. História completa no blog! 🚀 #casesucesso #resultados #marketing",
    type: "STATIC",
    status: NasaPlannerPostStatus.APPROVED,
    networks: ["INSTAGRAM", "FACEBOOK"],
    offsetDays: 0,
    thumbnail: THUMB_URLS[7],
  },
  {
    title: "Webinar — Marketing Digital 2026",
    caption: "Participe do nosso webinar gratuito sobre Marketing Digital em 2026! Vagas limitadas 👇 Link na bio. #webinar #marketing #digital",
    type: "STATIC",
    status: NasaPlannerPostStatus.SCHEDULED,
    networks: ["INSTAGRAM", "FACEBOOK"],
    offsetDays: 2,
    thumbnail: THUMB_URLS[3],
  },
  {
    title: "Reels — 5 tendências do mês",
    caption: "As 5 tendências de marketing que você precisa aplicar esse mês! 🔥 #tendências #marketing2026 #dicas",
    type: "REEL",
    status: NasaPlannerPostStatus.SCHEDULED,
    networks: ["INSTAGRAM", "TIKTOK"],
    offsetDays: 4,
    thumbnail: THUMB_URLS[1],
  },
  {
    title: "Oferta especial — Fim de semana",
    caption: "Esse fim de semana tem desconto especial para nossos seguidores! Use o código FDSOCIAL e garanta 20% OFF 🎁 #promoção #desconto #oferta",
    type: "CAROUSEL",
    status: NasaPlannerPostStatus.SCHEDULED,
    networks: ["INSTAGRAM", "FACEBOOK"],
    offsetDays: 5,
    thumbnail: THUMB_URLS[4],
  },
  {
    title: "Tutorial rápido — Funcionalidade nova",
    caption: "Lançamos uma nova funcionalidade incrível! Veja como usar em 60 segundos ⚡ #tutorial #novidade #produto",
    type: "REEL",
    status: NasaPlannerPostStatus.PENDING_APPROVAL,
    networks: ["INSTAGRAM", "TIKTOK"],
    offsetDays: 7,
    thumbnail: THUMB_URLS[6],
  },
  {
    title: "Post motivacional — segunda-feira",
    caption: "A semana começa com energia! 💪 Qual é seu objetivo dessa semana? Conta pra gente nos comentários! #motivação #segundafeira #energia",
    type: "STATIC",
    status: NasaPlannerPostStatus.DRAFT,
    networks: ["INSTAGRAM"],
    offsetDays: 8,
    thumbnail: THUMB_URLS[2],
  },
  {
    title: "Carrossel — Guia completo de SEO",
    caption: "O guia completo de SEO para iniciantes! 📈 Salva esse post para não perder! #SEO #marketing #digital #guia",
    type: "CAROUSEL",
    status: NasaPlannerPostStatus.DRAFT,
    networks: ["INSTAGRAM", "FACEBOOK"],
    offsetDays: 10,
    thumbnail: THUMB_URLS[7],
  },
  {
    title: "Parceria — Collab especial",
    caption: "Temos um anúncio incrível chegando... 👀 Fica ligado! #parceria #novidade #em breve",
    type: "STATIC",
    status: NasaPlannerPostStatus.DRAFT,
    networks: ["INSTAGRAM"],
    offsetDays: 14,
    thumbnail: THUMB_URLS[0],
  },
];

async function main() {
  console.log("🌱 Seeding NASA Planner demo...\n");

  // Limpar posts anteriores do seed (identificados pelo prefixo no título)
  const deleted = await prisma.nasaPlannerPost.deleteMany({
    where: {
      plannerId: PLANNER_ID,
      title: { in: posts.map((p) => p.title) },
    },
  });
  if (deleted.count > 0) console.log(`🗑️  Removidos ${deleted.count} posts anteriores`);

  const today = dayjs();
  const created: string[] = [];

  for (const post of posts) {
    const date = today.add(post.offsetDays, "day").toDate();

    const isPublished = post.status === NasaPlannerPostStatus.PUBLISHED;
    const isScheduled = post.status === NasaPlannerPostStatus.SCHEDULED;

    const created_ = await prisma.nasaPlannerPost.create({
      data: {
        planner: { connect: { id: PLANNER_ID } },
        createdBy: { connect: { id: CREATED_BY_ID } },
        organizationId: ORG_ID,
        title: post.title,
        caption: post.caption,
        type: post.type,
        status: post.status,
        targetNetworks: post.networks,
        thumbnail: post.thumbnail,
        publishedAt: isPublished ? date : null,
        scheduledAt: isScheduled ? date : null,
        slides: post.thumbnail
          ? {
              create: {
                order: 1,
                imageKey: post.thumbnail,
                headline: post.title,
                targetFormat: "1:1",
              },
            }
          : undefined,
      },
    });

    created.push(created_.id);
    const icon =
      post.status === "PUBLISHED" ? "✅" :
      post.status === "SCHEDULED" ? "🕒" :
      post.status === "APPROVED" ? "👍" :
      post.status === "PENDING_APPROVAL" ? "⏳" : "📝";

    console.log(`${icon} ${post.title.slice(0, 50)} [${post.status}] — ${dayjs(date).format("DD/MM")}`);
  }

  console.log(`\n✨ ${created.length} posts criados no Planner!\n`);
  console.log("🔗 Acesse: http://localhost:3000 → NASA Planner");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
