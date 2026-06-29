/**
 * Seed de datas comemorativas brasileiras 2026 no Calendário Workspace.
 *
 * Cria uma Action por data (criador = usuário logado, vinculada ao primeiro
 * workspace ativo da org). Cada ação fica como evento "all-day" das 09h às 18h.
 *
 * Uso:
 *   npx tsx scripts/seed-holidays-2026.ts
 *
 * Idempotente: usa prefixo [HOLIDAY] no título para identificar e re-aplica
 * sempre via upsert lógico (delete + insert do conjunto inteiro).
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const USER_EMAIL = process.env.SEED_USER_EMAIL ?? "batman@gmail.com";
const YEAR = 2026;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
} as any);
const prisma = new PrismaClient({ adapter } as any);

interface Holiday {
  /** Mês (1-12) */
  month: number;
  /** Dia */
  day: number;
  /** Título exibido (sem prefixo, vamos prefixar [HOLIDAY] na criação) */
  title: string;
  /** Descrição curta */
  description?: string;
  /** Cover opcional (Unsplash) */
  cover?: string;
}

// ─── Catálogo de datas comemorativas brasileiras 2026 ──────────────────────
// Datas móveis calculadas para 2026 (Páscoa em 05/04/2026):
//   Carnaval (seg/ter): 16-17/02
//   Quarta-feira de Cinzas: 18/02
//   Domingo de Ramos: 29/03
//   Quinta-feira Santa: 02/04
//   Sexta-feira Santa: 03/04
//   Páscoa: 05/04
//   Corpus Christi: 04/06
//   Dia das Mães (2º dom. maio): 10/05
//   Dia dos Pais (2º dom. agosto): 09/08

const HOLIDAYS: Holiday[] = [
  // ─── Janeiro
  { month: 1, day: 1, title: "🎆 Confraternização Universal", description: "Feriado nacional — Ano Novo", cover: "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=1200" },
  { month: 1, day: 6, title: "🌟 Dia de Reis", description: "Tradição cristã" },
  { month: 1, day: 25, title: "🏙️ Aniversário de São Paulo", description: "Feriado municipal SP" },

  // ─── Fevereiro
  { month: 2, day: 2, title: "🌊 Dia de Iemanjá", description: "Tradição afro-brasileira" },
  { month: 2, day: 16, title: "🎭 Carnaval — Segunda-feira", description: "Ponto facultativo nacional", cover: "https://images.unsplash.com/photo-1516801967206-0afb47bdaa6e?w=1200" },
  { month: 2, day: 17, title: "🎭 Carnaval — Terça-feira", description: "Ponto facultativo nacional", cover: "https://images.unsplash.com/photo-1516801967206-0afb47bdaa6e?w=1200" },
  { month: 2, day: 18, title: "✝️ Quarta-feira de Cinzas", description: "Início da Quaresma" },
  { month: 2, day: 14, title: "💝 Valentine's Day", description: "Dia dos Namorados internacional" },

  // ─── Março
  { month: 3, day: 8, title: "👩 Dia Internacional da Mulher", description: "Data oficial da ONU", cover: "https://images.unsplash.com/photo-1581577832290-7c3e0c8e4906?w=1200" },
  { month: 3, day: 15, title: "🛡️ Dia do Consumidor", description: "Direitos do consumidor" },
  { month: 3, day: 19, title: "👨 Dia de São José", description: "Padroeiro da família" },
  { month: 3, day: 20, title: "🌸 Início do Outono", description: "Equinócio de outono" },
  { month: 3, day: 22, title: "💧 Dia Mundial da Água", description: "Conscientização ambiental" },
  { month: 3, day: 29, title: "🌿 Domingo de Ramos", description: "Início da Semana Santa" },

  // ─── Abril
  { month: 4, day: 1, title: "🤡 Dia da Mentira", description: "Brincadeiras tradicionais" },
  { month: 4, day: 2, title: "✝️ Quinta-feira Santa", description: "Semana Santa" },
  { month: 4, day: 3, title: "✝️ Sexta-feira Santa — Paixão de Cristo", description: "Feriado nacional" },
  { month: 4, day: 5, title: "🐰 Domingo de Páscoa", description: "Ressurreição de Cristo", cover: "https://images.unsplash.com/photo-1521967906867-14ec9d64bee8?w=1200" },
  { month: 4, day: 7, title: "❤️ Dia Mundial da Saúde", description: "OMS" },
  { month: 4, day: 19, title: "🪶 Dia dos Povos Indígenas", description: "Antigo Dia do Índio" },
  { month: 4, day: 21, title: "🇧🇷 Tiradentes", description: "Feriado nacional" },
  { month: 4, day: 22, title: "⛵ Descobrimento do Brasil", description: "Marco histórico" },
  { month: 4, day: 28, title: "🌍 Dia Mundial da Educação", description: "Conscientização" },

  // ─── Maio
  { month: 5, day: 1, title: "👷 Dia do Trabalho", description: "Feriado nacional", cover: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200" },
  { month: 5, day: 3, title: "📰 Dia Mundial da Liberdade de Imprensa", description: "UNESCO" },
  { month: 5, day: 10, title: "🌷 Dia das Mães", description: "Segundo domingo de maio", cover: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200" },
  { month: 5, day: 13, title: "✊ Abolição da Escravatura", description: "Lei Áurea (1888)" },
  { month: 5, day: 15, title: "👨‍👩‍👧 Dia Internacional da Família", description: "ONU" },
  { month: 5, day: 28, title: "🌸 Dia do Hambúrguer", description: "Curiosidade gastronômica" },

  // ─── Junho
  { month: 6, day: 4, title: "✝️ Corpus Christi", description: "Ponto facultativo nacional" },
  { month: 6, day: 5, title: "🌳 Dia Mundial do Meio Ambiente", description: "ONU" },
  { month: 6, day: 12, title: "💕 Dia dos Namorados", description: "Brasil — véspera de Sto Antônio", cover: "https://images.unsplash.com/photo-1522673607200-164d1b3ce551?w=1200" },
  { month: 6, day: 13, title: "💒 Dia de Santo Antônio", description: "Padroeiro dos casamentos" },
  { month: 6, day: 24, title: "🔥 Dia de São João", description: "Festa Junina", cover: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1200" },
  { month: 6, day: 28, title: "🏳️‍🌈 Dia Internacional do Orgulho LGBTQIA+", description: "Marco de Stonewall" },
  { month: 6, day: 29, title: "🎣 Dia de São Pedro", description: "Padroeiro dos pescadores" },

  // ─── Julho
  { month: 7, day: 9, title: "🛡️ Revolução Constitucionalista", description: "Feriado estadual SP" },
  { month: 7, day: 16, title: "⛵ Nossa Senhora do Carmo", description: "Padroeira" },
  { month: 7, day: 20, title: "🤝 Dia do Amigo", description: "Dia Internacional da Amizade" },
  { month: 7, day: 25, title: "👴 Dia dos Avós", description: "Homenagem aos avós" },
  { month: 7, day: 26, title: "👵 Dia da Vovó", description: "Tradição brasileira" },

  // ─── Agosto
  { month: 8, day: 9, title: "👔 Dia dos Pais", description: "Segundo domingo de agosto", cover: "https://images.unsplash.com/photo-1542037104857-ffbb0b9155fb?w=1200" },
  { month: 8, day: 11, title: "🎓 Dia do Estudante", description: "Brasil" },
  { month: 8, day: 12, title: "🌍 Dia Internacional da Juventude", description: "ONU" },
  { month: 8, day: 22, title: "🎨 Dia do Folclore", description: "Cultura popular" },
  { month: 8, day: 25, title: "🎖️ Dia do Soldado", description: "Aniversário de Caxias" },
  { month: 8, day: 28, title: "❤️ Dia da Avicultura", description: "" },

  // ─── Setembro
  { month: 9, day: 7, title: "🇧🇷 Independência do Brasil", description: "Feriado nacional", cover: "https://images.unsplash.com/photo-1518176258769-f227c798150e?w=1200" },
  { month: 9, day: 15, title: "🏛️ Dia Internacional da Democracia", description: "ONU" },
  { month: 9, day: 21, title: "🌸 Dia da Árvore / Início da Primavera", description: "Equinócio + meio ambiente" },
  { month: 9, day: 22, title: "💻 Dia do Profissional de TI", description: "Tecnologia da Informação" },
  { month: 9, day: 27, title: "✈️ Dia Mundial do Turismo", description: "OMT" },
  { month: 9, day: 30, title: "🌐 Dia do Tradutor", description: "Profissão" },

  // ─── Outubro
  { month: 10, day: 5, title: "👩‍🏫 Dia Mundial dos Professores", description: "UNESCO" },
  { month: 10, day: 12, title: "🙏 Nossa Senhora Aparecida + Dia das Crianças", description: "Feriado nacional", cover: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1200" },
  { month: 10, day: 15, title: "📚 Dia do Professor (Brasil)", description: "Data nacional", cover: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200" },
  { month: 10, day: 18, title: "⚕️ Dia do Médico", description: "São Lucas" },
  { month: 10, day: 28, title: "🏛️ Dia do Servidor Público", description: "Federal" },
  { month: 10, day: 31, title: "🎃 Halloween / Dia das Bruxas", description: "Tradição internacional", cover: "https://images.unsplash.com/photo-1509557965875-b88c97052f0a?w=1200" },

  // ─── Novembro
  { month: 11, day: 2, title: "🕯️ Finados", description: "Feriado nacional" },
  { month: 11, day: 15, title: "🇧🇷 Proclamação da República", description: "Feriado nacional" },
  { month: 11, day: 19, title: "🚩 Dia da Bandeira", description: "Símbolos nacionais" },
  { month: 11, day: 20, title: "✊🏿 Dia da Consciência Negra", description: "Feriado em vários estados", cover: "https://images.unsplash.com/photo-1604063155785-ee4488b8ad15?w=1200" },
  { month: 11, day: 27, title: "🛍️ Black Friday", description: "Grande varejo (última sexta de novembro)", cover: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200" },
  { month: 11, day: 30, title: "📦 Cyber Monday", description: "E-commerce" },

  // ─── Dezembro
  { month: 12, day: 8, title: "🙏 Imaculada Conceição", description: "Padroeira de muitas cidades" },
  { month: 12, day: 10, title: "🕊️ Dia dos Direitos Humanos", description: "ONU" },
  { month: 12, day: 24, title: "🎄 Véspera de Natal", description: "Ceia de Natal", cover: "https://images.unsplash.com/photo-1543589077-47d81606c1bf?w=1200" },
  { month: 12, day: 25, title: "🎅 Natal", description: "Feriado nacional", cover: "https://images.unsplash.com/photo-1543589077-47d81606c1bf?w=1200" },
  { month: 12, day: 31, title: "🎆 Réveillon — Véspera de Ano Novo", description: "Confraternização", cover: "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=1200" },
];

function setTime(year: number, month: number, day: number, hh: number, mm = 0): Date {
  const d = new Date(year, month - 1, day);
  d.setHours(hh, mm, 0, 0);
  return d;
}

async function main() {
  // 1. User
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, name: true },
  });
  if (!user) throw new Error(`Usuário não encontrado: ${USER_EMAIL}`);

  // 2. Org
  const member = await prisma.member.findFirst({
    where: { userId: user.id },
    select: {
      organizationId: true,
      organization: { select: { id: true, name: true } },
    },
  });
  if (!member) throw new Error("Usuário sem organização");

  console.log(`✓ User: ${user.name}`);
  console.log(`✓ Org : ${member.organization.name}`);
  console.log(`✓ Ano : ${YEAR}\n`);

  // 3. Workspace + primeira coluna (necessário para Action)
  const workspace = await prisma.workspace.findFirst({
    where: { organizationId: member.organizationId, isArchived: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      columns: {
        orderBy: { order: "asc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!workspace) throw new Error("Nenhum workspace ativo encontrado");
  if (!workspace.columns[0]) throw new Error("Workspace sem colunas");

  console.log(`✓ Workspace alvo: ${workspace.name} (${workspace.id})\n`);

  // 4. Limpar holidays do ano (evita duplicação ao re-rodar)
  const deleted = await prisma.action.deleteMany({
    where: {
      organizationId: member.organizationId,
      title: { startsWith: "[HOLIDAY]" },
      startDate: {
        gte: new Date(YEAR, 0, 1),
        lt: new Date(YEAR + 1, 0, 1),
      },
    },
  });
  if (deleted.count > 0) {
    console.log(`🧹 Removidos ${deleted.count} holidays antigos de ${YEAR}\n`);
  }

  // 5. Criar todas as ações
  let created = 0;
  for (const h of HOLIDAYS) {
    const start = setTime(YEAR, h.month, h.day, 9, 0);
    const end = setTime(YEAR, h.month, h.day, 18, 0);

    await prisma.action.create({
      data: {
        title: `[HOLIDAY] ${h.title}`,
        description: h.description ?? null,
        type: "ACTION",
        priority: "NONE",
        startDate: start,
        endDate: end,
        dueDate: end,
        workspaceId: workspace.id,
        columnId: workspace.columns[0]!.id,
        organizationId: member.organizationId,
        createdBy: user.id,
        coverImage: h.cover ?? null,
        isDone: false,
      },
    });
    created++;
  }

  console.log(`✅ ${created} datas comemorativas inseridas para ${YEAR}`);
  console.log(`   Distribuição:`);

  // Stats por mês
  const byMonth = HOLIDAYS.reduce<Record<number, number>>((acc, h) => {
    acc[h.month] = (acc[h.month] ?? 0) + 1;
    return acc;
  }, {});
  const monthNames = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  for (let m = 1; m <= 12; m++) {
    if (byMonth[m]) {
      console.log(`     ${monthNames[m - 1]}: ${byMonth[m]} datas`);
    }
  }
}

main()
  .catch((e) => {
    console.error("❌ Falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
