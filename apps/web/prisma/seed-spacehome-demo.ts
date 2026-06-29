/**
 * Seed de DEMONSTRAÇÃO — Spacehome ASTRO BAT (/space/astronasa)
 *
 * Popula dados fictícios em TODOS os cards do template default da Spacehome
 * para que o usuário possa ver visualmente como a página fica preenchida.
 *
 * Rode com:  npx tsx prisma/seed-spacehome-demo.ts
 *
 * 100% idempotente — pode rodar quantas vezes quiser (usa upsert por id).
 *
 * Cards populados (DEFAULT_LAYOUT):
 *   header        → bannerUrl da Organization
 *   projects      → 4 OrgProjects ativos
 *   ranking       → UserSpacePoint para cada membro de teste
 *   calendar      → 6 Actions públicas (eventos)
 *   nbox          → 4 NBoxItems públicos
 *   forms         → 3 Forms publicados
 *   news          → 4 CompanyPosts publicados
 *   reviews       → 6 CompanyReviews APPROVED
 *   stars         → SpaceStationStar (4 envios de outras stations + starsReceived na station da org)
 *   followers     → 5 OrgFollows
 *   space-station → não precisa de dados (só renderiza botão)
 *   footer        → não precisa
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

// ─── Constantes da org ASTRO BAT / station "astronasa" ──────────────────────
const ORG_ID = "CCJpQR5dBVr2ipHE1KgAfKSENXnx6RQ7";
const STATION_ID = "cmo4qc48100010pxboufmf5t8";
const WORKSPACE_ID = "cmockeiiz000805xblb90b348";

const OWNER_ID = "q8tjOBhOJ2xmSijMBYnLxruzJ7bsl0BT";        // Batman (owner)
const USER_BETA = "test-beta-user-001";
const USER_GAMMA = "test-gamma-user-002";
const USER_DELTA = "test-delta-user-003";
const USER_ASTRO2 = "cmo8uxl5v0000gbxb8bhltiqv";
const USER_ASTRO = "SQg3ScBv4Xa9SJxRuo2Im9KYRmATW2GX";       // já tem station

const STATION_BETA = "station-test-beta-user-001";
const STATION_GAMMA = "station-test-gamma-user-002";
const STATION_DELTA = "station-test-delta-user-003";
const STATION_ASTRO = "station-SQg3ScBv4Xa9SJxRuo2Im9KYRmATW2GX";

// Prefixo de IDs gerados pelo seed — facilita re-run idempotente e cleanup
const ID_PREFIX = "spacehome-demo";

async function main() {
  console.log("🚀 Spacehome demo seed — ASTRO BAT (/space/astronasa)\n");

  // ── 1. Header: banner da org ──────────────────────────────────────────
  await prisma.organization.update({
    where: { id: ORG_ID },
    data: {
      bannerUrl:
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
      website: "https://nasaagents.com",
      bio: "Estúdio multidisciplinar de tecnologia, design e aceleração de empresas — operando no universo NASA.",
    },
  });
  console.log("✅ Header: banner + bio + website atualizados");

  // ── 2. Projects: OrgProject ───────────────────────────────────────────
  const projects = [
    {
      id: `${ID_PREFIX}-proj-1`,
      name: "Lançamento Apollo XII",
      type: "project",
      description: "Plataforma de lançamento da nova linha de IAs corporativas — go-live previsto Q3.",
      avatar: "https://api.dicebear.com/9.x/shapes/svg?seed=apollo&backgroundColor=7c3aed",
      color: "#7c3aed",
      website: "https://nasaagents.com/projects/apollo",
      slogan: "A nova fronteira da automação inteligente",
    },
    {
      id: `${ID_PREFIX}-proj-2`,
      name: "Cliente — Lunar Tech",
      type: "client",
      description: "Conta estratégica de tecnologia espacial. Pipeline ativo, automações em produção.",
      avatar: "https://api.dicebear.com/9.x/shapes/svg?seed=lunar&backgroundColor=06b6d4",
      color: "#06b6d4",
      website: "https://lunartech.example",
      slogan: "From earth to the moon, one rocket at a time",
    },
    {
      id: `${ID_PREFIX}-proj-3`,
      name: "Marca — Galaxy Studios",
      type: "client",
      description: "Brand discovery + posicionamento de mercado para o estúdio de animação.",
      avatar: "https://api.dicebear.com/9.x/shapes/svg?seed=galaxy&backgroundColor=f59e0b",
      color: "#f59e0b",
      website: "https://galaxystudios.example",
      slogan: "Where stars are born",
    },
    {
      id: `${ID_PREFIX}-proj-4`,
      name: "Operação Mars Rover",
      type: "project",
      description: "Programa interno de exploração de novos mercados B2B — pesquisa + prospecção.",
      avatar: "https://api.dicebear.com/9.x/shapes/svg?seed=mars&backgroundColor=ef4444",
      color: "#ef4444",
      website: null,
      slogan: "Explore the unknown",
    },
  ];
  for (const p of projects) {
    await prisma.orgProject.upsert({
      where: { id: p.id },
      create: {
        ...p,
        organizationId: ORG_ID,
        isActive: true,
      },
      update: {
        name: p.name,
        type: p.type,
        description: p.description,
        avatar: p.avatar,
        color: p.color,
        website: p.website,
        slogan: p.slogan,
        isActive: true,
      },
    });
  }
  console.log(`✅ Projects: ${projects.length} OrgProjects ativos`);

  // ── 3. Calendar: Actions públicas (eventos) ──────────────────────────
  const colId = "cmockeinf000e05xbiiwo9z81"; // "Para fazer"
  const now = new Date();
  const daysFromNow = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    d.setHours(14, 0, 0, 0);
    return d;
  };
  const events = [
    {
      id: `${ID_PREFIX}-event-1`,
      title: "Workshop: IA Generativa para Vendas",
      description: "Hands-on de prompts, automação e funis de vendas com agentes NASA.",
      cat: "WORKSHOP" as const,
      offset: 3,
      hours: 3,
      cover: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80",
      city: "São Paulo",
      st: "SP",
      addr: "Av. Paulista, 1000 — 12º andar",
    },
    {
      id: `${ID_PREFIX}-event-2`,
      title: "Palestra: O futuro do CRM espacial",
      description: "Como dados e IA estão reescrevendo a forma como vendemos.",
      cat: "PALESTRA" as const,
      offset: 7,
      hours: 2,
      cover: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80",
      city: "Rio de Janeiro",
      st: "RJ",
      addr: "Centro de Convenções Sulamérica",
    },
    {
      id: `${ID_PREFIX}-event-3`,
      title: "Lançamento — NASA Pages 2.0",
      description: "Apresentação oficial da nova versão do criador de páginas.",
      cat: "LANCAMENTO" as const,
      offset: 12,
      hours: 1,
      cover: "https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=1200&q=80",
      city: "Online",
      st: "BR",
      addr: "Transmissão ao vivo no YouTube",
    },
    {
      id: `${ID_PREFIX}-event-4`,
      title: "Webinar: Brand Strategy para SaaS",
      description: "1h direto ao ponto sobre posicionamento, naming e brand voice.",
      cat: "WEBINAR" as const,
      offset: 18,
      hours: 1,
      cover: "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=1200&q=80",
      city: "Online",
      st: "BR",
      addr: "Zoom",
    },
    {
      id: `${ID_PREFIX}-event-5`,
      title: "Networking ASTRO — Empresas",
      description: "Encontro presencial de gestores das empresas do ecossistema NASA.",
      cat: "NETWORKING" as const,
      offset: 25,
      hours: 4,
      cover: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80",
      city: "Belo Horizonte",
      st: "MG",
      addr: "Espaço NASA — Savassi",
    },
    {
      id: `${ID_PREFIX}-event-6`,
      title: "Curso: Automações com Inngest",
      description: "Mão na massa: do hello-world ao workflow em produção.",
      cat: "CURSO" as const,
      offset: 32,
      hours: 6,
      cover: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
      city: "Online",
      st: "BR",
      addr: "Sala virtual",
    },
  ];
  for (const e of events) {
    const start = daysFromNow(e.offset);
    const end = new Date(start);
    end.setHours(start.getHours() + e.hours);
    await prisma.action.upsert({
      where: { id: e.id },
      create: {
        id: e.id,
        title: e.title,
        description: e.description,
        type: "MEETING",
        workspaceId: WORKSPACE_ID,
        columnId: colId,
        organizationId: ORG_ID,
        createdBy: OWNER_ID,
        startDate: start,
        endDate: end,
        isPublic: true,
        publishedAt: now,
        publicSlug: `${e.id}-slug`,
        eventCategory: e.cat,
        coverImage: e.cover,
        city: e.city,
        state: e.st,
        address: e.addr,
        country: "BR",
      },
      update: {
        title: e.title,
        description: e.description,
        startDate: start,
        endDate: end,
        isPublic: true,
        publishedAt: now,
        eventCategory: e.cat,
        coverImage: e.cover,
        city: e.city,
        state: e.st,
        address: e.addr,
      },
    });
  }
  console.log(`✅ Calendar: ${events.length} Actions públicas`);

  // ── 4. NBox: arquivos públicos ───────────────────────────────────────
  const nboxItems = [
    {
      id: `${ID_PREFIX}-nbox-1`,
      name: "Press Kit ASTRO BAT 2026.pdf",
      description: "Logos, paleta de cor, foto do time e bio oficial.",
      type: "FILE" as const,
      mime: "application/pdf",
      size: 4_521_300,
      tags: ["press-kit", "branding", "público"],
    },
    {
      id: `${ID_PREFIX}-nbox-2`,
      name: "Catálogo de Serviços.pdf",
      description: "Lista completa de squads, deliverables e SLAs.",
      type: "FILE" as const,
      mime: "application/pdf",
      size: 2_104_500,
      tags: ["comercial", "vendas"],
    },
    {
      id: `${ID_PREFIX}-nbox-3`,
      name: "Apresentação institucional.pptx",
      description: "Deck de 18 slides — quem somos, manifesto, cases.",
      type: "FILE" as const,
      mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      size: 8_994_700,
      tags: ["pitch", "deck"],
    },
    {
      id: `${ID_PREFIX}-nbox-4`,
      name: "Logo ASTRO BAT (vetor).svg",
      description: "Versão oficial em SVG — fundo transparente.",
      type: "FILE" as const,
      mime: "image/svg+xml",
      size: 47_200,
      tags: ["logo", "vetor"],
    },
  ];
  for (const i of nboxItems) {
    await prisma.nBoxItem.upsert({
      where: { id: i.id },
      create: {
        id: i.id,
        organizationId: ORG_ID,
        createdById: OWNER_ID,
        type: i.type,
        name: i.name,
        description: i.description,
        mimeType: i.mime,
        size: i.size,
        tags: i.tags,
        isPublic: true,
        publicToken: `${i.id}-token`,
        url: "/uploads/demo-asset.pdf",
      },
      update: {
        name: i.name,
        description: i.description,
        mimeType: i.mime,
        size: i.size,
        tags: i.tags,
        isPublic: true,
      },
    });
  }
  console.log(`✅ NBox: ${nboxItems.length} arquivos públicos`);

  // ── 5. Forms publicados ─────────────────────────────────────────────
  const forms = [
    {
      id: `${ID_PREFIX}-form-1`,
      name: "Trabalhe Conosco",
      description: "Envie seu currículo e venha pilotar com a gente.",
      shareUrl: `${ID_PREFIX}-form-1-share`,
      views: 247,
      responses: 38,
    },
    {
      id: `${ID_PREFIX}-form-2`,
      name: "Fale com Comercial",
      description: "Conte rapidamente seu desafio. Nossa equipe responde em até 24h.",
      shareUrl: `${ID_PREFIX}-form-2-share`,
      views: 892,
      responses: 102,
    },
    {
      id: `${ID_PREFIX}-form-3`,
      name: "Inscrição em Eventos",
      description: "Garanta sua vaga em workshops, palestras e cursos da ASTRO BAT.",
      shareUrl: `${ID_PREFIX}-form-3-share`,
      views: 415,
      responses: 71,
    },
  ];
  for (const f of forms) {
    await prisma.form.upsert({
      where: { id: f.id },
      create: {
        id: f.id,
        userId: OWNER_ID,
        organizationId: ORG_ID,
        name: f.name,
        description: f.description,
        published: true,
        content: "Formulário institucional",
        jsonBlock: "[]",
        shareUrl: f.shareUrl,
        views: f.views,
        responses: f.responses,
      },
      update: {
        name: f.name,
        description: f.description,
        published: true,
        views: f.views,
        responses: f.responses,
      },
    });
  }
  console.log(`✅ Forms: ${forms.length} formulários publicados`);

  // ── 6. News: CompanyPosts ───────────────────────────────────────────
  const tipTapDoc = (text: string) => ({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text }] },
    ],
  });
  const posts = [
    {
      id: `${ID_PREFIX}-post-1`,
      slug: `${ID_PREFIX}-post-1-slug`,
      title: "ASTRO BAT lança novo módulo de IA para vendas",
      excerpt: "Conheça o NASA AI Sales Copilot — agora integrado ao Tracking.",
      cover: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80",
      content: "Hoje anunciamos o lançamento oficial do NASA AI Sales Copilot, um copiloto de inteligência artificial integrado nativamente ao módulo Tracking da plataforma. A nova ferramenta promete reduzir em até 40% o tempo dedicado a tarefas operacionais.",
      offset: -2,
      views: 1247,
    },
    {
      id: `${ID_PREFIX}-post-2`,
      slug: `${ID_PREFIX}-post-2-slug`,
      title: "Como reduzimos o tempo de onboarding em 60%",
      excerpt: "Os bastidores do nosso novo fluxo de Client Onboarding automatizado.",
      cover: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
      content: "Há 6 meses começamos um projeto interno para repensar completamente o onboarding de novos clientes. Os resultados foram surpreendentes — neste artigo, contamos cada passo da jornada.",
      offset: -8,
      views: 892,
    },
    {
      id: `${ID_PREFIX}-post-3`,
      slug: `${ID_PREFIX}-post-3-slug`,
      title: "Estamos contratando: 8 vagas abertas",
      excerpt: "De engenharia a marketing — venha pilotar conosco.",
      cover: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
      content: "A ASTRO BAT está crescendo, e queremos pessoas brilhantes para crescer junto. Confira as vagas abertas para Engenheiros, Designers, Marketers e mais.",
      offset: -15,
      views: 2104,
    },
    {
      id: `${ID_PREFIX}-post-4`,
      slug: `${ID_PREFIX}-post-4-slug`,
      title: "Case: como a Lunar Tech multiplicou leads por 3x",
      excerpt: "Estratégia, automação e muita ciência de dados.",
      cover: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
      content: "A Lunar Tech procurou a ASTRO BAT em busca de uma estratégia para escalar seu pipeline de vendas. Em 4 meses de trabalho conjunto, triplicamos o volume de leads qualificados.",
      offset: -25,
      views: 671,
    },
  ];
  for (const p of posts) {
    const publishedAt = new Date(now);
    publishedAt.setDate(publishedAt.getDate() + p.offset);
    await prisma.companyPost.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        orgId: ORG_ID,
        authorId: OWNER_ID,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        coverUrl: p.cover,
        content: tipTapDoc(p.content) as any,
        isPublished: true,
        publishedAt,
        viewCount: p.views,
      },
      update: {
        title: p.title,
        excerpt: p.excerpt,
        coverUrl: p.cover,
        content: tipTapDoc(p.content) as any,
        isPublished: true,
        publishedAt,
        viewCount: p.views,
      },
    });
  }
  console.log(`✅ News: ${posts.length} CompanyPosts publicados`);

  // ── 7. Reviews APROVADAS ────────────────────────────────────────────
  const reviews = [
    {
      id: `${ID_PREFIX}-review-1`,
      authorId: USER_BETA,
      authorName: "Astronauta Beta",
      rating: 5,
      title: "Time absurdamente competente",
      comment: "Trabalhei como cliente da ASTRO BAT por 8 meses. Entrega rápida, qualidade impecável e atendimento excelente. Recomendo de olhos fechados.",
      verified: true,
      offset: -3,
    },
    {
      id: `${ID_PREFIX}-review-2`,
      authorId: USER_GAMMA,
      authorName: "Astronauta Gamma",
      rating: 5,
      title: "Mudou completamente nosso pipeline",
      comment: "A integração com IA + automação é absurdamente boa. Saímos de 30 leads/mês para 120 em 3 meses.",
      verified: true,
      offset: -7,
    },
    {
      id: `${ID_PREFIX}-review-3`,
      authorId: null,
      authorName: "Visitante anônimo",
      rating: 4,
      title: "Excelente, mas pode melhorar onboarding",
      comment: "O produto é incrível e o atendimento é muito bom. Senti um pouco de fricção no primeiro contato, mas depois fluiu lindamente.",
      verified: false,
      offset: -11,
    },
    {
      id: `${ID_PREFIX}-review-4`,
      authorId: USER_DELTA,
      authorName: "Astronauta Delta",
      rating: 5,
      title: "Suporte é destaque",
      comment: "Já usei várias plataformas e o que mais me impressiona aqui é o suporte humano e rápido. Time da ASTRO BAT manda muito bem.",
      verified: true,
      offset: -16,
    },
    {
      id: `${ID_PREFIX}-review-5`,
      authorId: null,
      authorName: "Carla Mendes",
      rating: 5,
      title: "Vale cada centavo",
      comment: "Já experimentei concorrentes — nenhum chega perto da experiência aqui. ROI surreal no primeiro trimestre.",
      verified: false,
      offset: -22,
    },
    {
      id: `${ID_PREFIX}-review-6`,
      authorId: USER_ASTRO2,
      authorName: "Astro 2",
      rating: 4,
      title: "Plataforma poderosa",
      comment: "Curva de aprendizado existe, mas depois que pega o jeito é uma das melhores ferramentas que usei.",
      verified: true,
      offset: -30,
    },
  ];
  for (const r of reviews) {
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() + r.offset);
    await prisma.companyReview.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        orgId: ORG_ID,
        authorId: r.authorId,
        authorName: r.authorName,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        verified: r.verified,
        status: "APPROVED",
        createdAt,
      },
      update: {
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        verified: r.verified,
        status: "APPROVED",
      },
    });
  }
  console.log(`✅ Reviews: ${reviews.length} CompanyReviews APROVADAS`);

  // ── 8. Followers ────────────────────────────────────────────────────
  const followers = [
    USER_BETA,
    USER_GAMMA,
    USER_DELTA,
    USER_ASTRO,
    USER_ASTRO2,
  ];
  for (const userId of followers) {
    await prisma.orgFollow.upsert({
      where: { orgId_userId: { orgId: ORG_ID, userId } },
      create: { orgId: ORG_ID, userId },
      update: {},
    });
  }
  console.log(`✅ Followers: ${followers.length} OrgFollows`);

  // ── 9. Ranking: UserSpacePoint ──────────────────────────────────────
  const points = [
    { userId: OWNER_ID, total: 12480, weekly: 940 },
    { userId: USER_BETA, total: 8920, weekly: 712 },
    { userId: USER_GAMMA, total: 7314, weekly: 588 },
    { userId: USER_DELTA, total: 5102, weekly: 405 },
    { userId: USER_ASTRO2, total: 3247, weekly: 280 },
  ];
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  for (const p of points) {
    // OBS: o índice único (userId, orgId) declarado no schema não existe
    // ainda no banco — usamos findFirst + update/create para contornar.
    const existing = await prisma.userSpacePoint.findFirst({
      where: { userId: p.userId, orgId: ORG_ID },
      select: { id: true },
    });
    if (existing) {
      await prisma.userSpacePoint.update({
        where: { id: existing.id },
        data: { totalPoints: p.total, weeklyPoints: p.weekly, weekStart },
      });
    } else {
      await prisma.userSpacePoint.create({
        data: {
          userId: p.userId,
          orgId: ORG_ID,
          totalPoints: p.total,
          weeklyPoints: p.weekly,
          weekStart,
        },
      });
    }
  }
  console.log(`✅ Ranking: ${points.length} UserSpacePoint`);

  // ── 10. Stars enviadas para a station da org ────────────────────────
  const stars = [
    { id: `${ID_PREFIX}-star-1`, fromId: STATION_BETA, amount: 25, message: "Time TOP!" },
    { id: `${ID_PREFIX}-star-2`, fromId: STATION_GAMMA, amount: 50, message: "Trabalho impecável esta semana 🚀" },
    { id: `${ID_PREFIX}-star-3`, fromId: STATION_DELTA, amount: 15, message: null },
    { id: `${ID_PREFIX}-star-4`, fromId: STATION_ASTRO, amount: 100, message: "Vamos pra Lua!" },
    { id: `${ID_PREFIX}-star-5`, fromId: STATION_BETA, amount: 30, message: "Lançamento lindo demais" },
  ];
  let totalStars = 0;
  for (const s of stars) {
    await prisma.spaceStationStar.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        fromId: s.fromId,
        toId: STATION_ID,
        amount: s.amount,
        message: s.message,
      },
      update: {
        amount: s.amount,
        message: s.message,
      },
    });
    totalStars += s.amount;
  }
  // Atualiza contador agregado da station receptora
  await prisma.spaceStation.update({
    where: { id: STATION_ID },
    data: { starsReceived: totalStars },
  });
  console.log(`✅ Stars: ${stars.length} envios = ${totalStars} STARs recebidas`);

  console.log("\n🎉 Spacehome demo seed concluído!");
  console.log("👉 Acesse: http://localhost:3001/space/astronasa");
}

main()
  .catch((e) => {
    console.error("❌ Falha:", e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
