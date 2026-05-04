/**
 * Seed de Eventos do Workspace — Demo
 *
 * Popula Actions (eventos/tarefas/reuniões) no workspace do usuário indicado,
 * distribuídos no calendário de Abril–Junho/2026 para visualização imediata.
 *
 * Rode com: npx tsx prisma/seed-workspace-events-demo.ts
 *
 * Idempotente — exclui events do seed antes de recriar.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

const TARGET_EMAIL = "coringaforevernasa@gmail.com";

// Seed tag: identifica ações criadas por este seed
const SEED_TAG = "[seed-demo]";

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function withHour(date: Date, hour: number, minute = 0): Date {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  console.log(`\n🌱 Seed Workspace Events — usuário: ${TARGET_EMAIL}\n`);

  // ── 1. Localiza usuário ──────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: {
      members: { include: { organization: true } },
    },
  });

  if (!user) {
    console.error(`❌ Usuário "${TARGET_EMAIL}" não encontrado no banco.`);
    process.exit(1);
  }

  console.log(`✅ Usuário encontrado: ${user.name ?? user.email} (${user.id})`);

  // ── 2. Localiza organização do usuário ───────────────────────────────────
  const orgMember = user.members[0];
  if (!orgMember) {
    console.error("❌ Usuário não pertence a nenhuma organização.");
    process.exit(1);
  }

  const organization = orgMember.organization;
  console.log(`✅ Organização: ${organization.name} (${organization.id})`);

  // ── 3. Localiza ou cria workspace ────────────────────────────────────────
  let workspace = await prisma.workspace.findFirst({
    where: {
      organizationId: organization.id,
      isArchived: false,
    },
    include: { columns: { orderBy: { order: "asc" } } },
  });

  if (!workspace) {
    console.log("⚙️  Nenhum workspace encontrado — criando workspace demo...");
    workspace = await prisma.workspace.create({
      data: {
        name: "Workspace Demo",
        description: "Workspace criado pelo seed de eventos demo",
        organizationId: organization.id,
        createdBy: user.id,
        color: "#1447e6",
        visibility: "PRIVATE",
        columns: {
          create: [
            { name: "A Fazer", color: "#6366f1", order: 1 },
            { name: "Em Progresso", color: "#f59e0b", order: 2 },
            { name: "Concluído", color: "#10b981", order: 3 },
          ],
        },
        members: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
      include: { columns: { orderBy: { order: "asc" } } },
    });
    console.log(`✅ Workspace criado: ${workspace.name}`);
  } else {
    console.log(`✅ Workspace encontrado: ${workspace.name} (${workspace.id})`);

    // Garante que o usuário é membro do workspace (necessário para listWorkspace e calendar)
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      create: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
      update: { role: "OWNER" },
    });
    console.log(`✅ WorkspaceMember garantido (OWNER)`);
  }

  // Garante que há ao menos uma coluna
  let columns = workspace.columns;
  if (columns.length === 0) {
    console.log("⚙️  Criando colunas padrão...");
    await prisma.workspaceColumn.createMany({
      data: [
        { name: "A Fazer", color: "#6366f1", order: 1, workspaceId: workspace.id },
        { name: "Em Progresso", color: "#f59e0b", order: 2, workspaceId: workspace.id },
        { name: "Concluído", color: "#10b981", order: 3, workspaceId: workspace.id },
      ],
    });
    columns = await prisma.workspaceColumn.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { order: "asc" },
    });
  }

  const colTodo = columns[0];
  const colInProgress = columns[1] ?? columns[0];
  const colDone = columns[2] ?? columns[0];

  // ── 4. Remove eventos anteriores deste seed ──────────────────────────────
  const deleted = await prisma.action.deleteMany({
    where: {
      workspaceId: workspace.id,
      createdBy: user.id,
      title: { startsWith: SEED_TAG },
    },
  });
  if (deleted.count > 0) {
    console.log(`🗑️  Removidos ${deleted.count} eventos antigos do seed.`);
  }

  // ── 5. Define os eventos ─────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events: Parameters<typeof prisma.action.create>[0]["data"][] = [
    // ── Passado (concluídos) ──────────────────────────────────────────────
    {
      title: `${SEED_TAG} Kickoff do Projeto Q2`,
      description:
        "Reunião inicial para alinhamento de metas e responsabilidades do trimestre.",
      type: "MEETING",
      priority: "HIGH",
      eventCategory: "REUNIAO",
      startDate: withHour(daysFromNow(-14), 9),
      endDate: withHour(daysFromNow(-14), 10, 30),
      dueDate: daysFromNow(-14),
      isDone: true,
      closedAt: daysFromNow(-14),
      workspaceId: workspace.id,
      columnId: colDone.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 1,
    },
    {
      title: `${SEED_TAG} Workshop de Onboarding NASA`,
      description:
        "Sessão prática de onboarding para novos usuários da plataforma — funcionalidades de Tracking e Workspace.",
      type: "ACTION",
      priority: "MEDIUM",
      eventCategory: "WORKSHOP",
      startDate: withHour(daysFromNow(-10), 14),
      endDate: withHour(daysFromNow(-10), 17),
      dueDate: daysFromNow(-10),
      isDone: true,
      closedAt: daysFromNow(-10),
      workspaceId: workspace.id,
      columnId: colDone.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 2,
    },
    {
      title: `${SEED_TAG} Revisão de Metas — Março`,
      description: "Análise dos resultados do mês anterior e ajuste de OKRs.",
      type: "MEETING",
      priority: "HIGH",
      eventCategory: "REUNIAO",
      startDate: withHour(daysFromNow(-7), 10),
      endDate: withHour(daysFromNow(-7), 11),
      dueDate: daysFromNow(-7),
      isDone: true,
      closedAt: daysFromNow(-7),
      workspaceId: workspace.id,
      columnId: colDone.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 3,
    },

    // ── Esta semana (em andamento) ────────────────────────────────────────
    {
      title: `${SEED_TAG} Preparação do Relatório Mensal`,
      description:
        "Compilar métricas de leads, conversões e receita para o relatório executivo.",
      type: "TASK",
      priority: "HIGH",
      startDate: withHour(daysFromNow(-2), 9),
      endDate: withHour(daysFromNow(0), 18),
      dueDate: daysFromNow(0),
      isDone: false,
      workspaceId: workspace.id,
      columnId: colInProgress.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 4,
    },
    {
      title: `${SEED_TAG} Webinar: Automações com Inngest`,
      description:
        "Demonstração ao vivo de como configurar automações de follow-up com Inngest no NASA.",
      type: "ACTION",
      priority: "HIGH",
      eventCategory: "WEBINAR",
      startDate: withHour(daysFromNow(1), 19),
      endDate: withHour(daysFromNow(1), 20, 30),
      dueDate: daysFromNow(1),
      isDone: false,
      workspaceId: workspace.id,
      columnId: colInProgress.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 5,
    },

    // ── Próximos dias ─────────────────────────────────────────────────────
    {
      title: `${SEED_TAG} Palestra: Vendas B2B com CRM`,
      description:
        "Como estruturar um pipeline de vendas B2B eficiente usando tracking de leads e automações.",
      type: "ACTION",
      priority: "MEDIUM",
      eventCategory: "PALESTRA",
      startDate: withHour(daysFromNow(3), 10),
      endDate: withHour(daysFromNow(3), 11, 30),
      dueDate: daysFromNow(3),
      isDone: false,
      workspaceId: workspace.id,
      columnId: colTodo.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 6,
    },
    {
      title: `${SEED_TAG} Reunião 1:1 — Time Comercial`,
      description: "Feedback individual com os SDRs e closers sobre pipeline e objeções.",
      type: "MEETING",
      priority: "MEDIUM",
      eventCategory: "REUNIAO",
      startDate: withHour(daysFromNow(5), 15),
      endDate: withHour(daysFromNow(5), 16),
      dueDate: daysFromNow(5),
      isDone: false,
      workspaceId: workspace.id,
      columnId: colTodo.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 7,
    },
    {
      title: `${SEED_TAG} Curso: Qualificação de Leads BANT`,
      description:
        "Treinamento da metodologia BANT para o time de pré-vendas — Budget, Authority, Need, Timeline.",
      type: "ACTION",
      priority: "LOW",
      eventCategory: "CURSO",
      startDate: withHour(daysFromNow(7), 8),
      endDate: withHour(daysFromNow(7), 12),
      dueDate: daysFromNow(7),
      isDone: false,
      workspaceId: workspace.id,
      columnId: colTodo.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 8,
    },
    {
      title: `${SEED_TAG} Lançamento: NASA Partner Program`,
      description:
        "Evento de lançamento oficial do Programa de Parceiros NASA para leads qualificados.",
      type: "ACTION",
      priority: "URGENT",
      eventCategory: "LANCAMENTO",
      startDate: withHour(daysFromNow(10), 18),
      endDate: withHour(daysFromNow(10), 21),
      dueDate: daysFromNow(10),
      isDone: false,
      workspaceId: workspace.id,
      columnId: colTodo.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 9,
    },
    {
      title: `${SEED_TAG} Networking: Founders & Growth`,
      description:
        "Evento de networking com founders de startups e profissionais de Growth — troca de experiências e parcerias.",
      type: "ACTION",
      priority: "LOW",
      eventCategory: "NETWORKING",
      startDate: withHour(daysFromNow(14), 19),
      endDate: withHour(daysFromNow(14), 22),
      dueDate: daysFromNow(14),
      isDone: false,
      workspaceId: workspace.id,
      columnId: colTodo.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 10,
    },
    {
      title: `${SEED_TAG} Hackathon NASA: Integração IA`,
      description:
        "Hackathon interno para desenvolver features de IA no NASA — automações inteligentes e análise preditiva de leads.",
      type: "ACTION",
      priority: "HIGH",
      eventCategory: "HACKATHON",
      startDate: withHour(daysFromNow(18), 8),
      endDate: withHour(daysFromNow(19), 20),
      dueDate: daysFromNow(19),
      isDone: false,
      workspaceId: workspace.id,
      columnId: colTodo.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 11,
    },
    {
      title: `${SEED_TAG} Conferência SaaS Brasil 2026`,
      description:
        "Participação na maior conferência de SaaS do Brasil — painel sobre CRM e automação de vendas.",
      type: "ACTION",
      priority: "MEDIUM",
      eventCategory: "CONFERENCIA",
      startDate: withHour(daysFromNow(22), 9),
      endDate: withHour(daysFromNow(23), 18),
      dueDate: daysFromNow(23),
      isDone: false,
      workspaceId: workspace.id,
      columnId: colTodo.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 12,
    },
    {
      title: `${SEED_TAG} Nota: Estratégia de Expansão`,
      description: `# Estratégia de Expansão Q2 2026

## Objetivos
- Crescer 40% em MRR até junho
- Ativar programa de parceiros em 3 estados
- Lançar integração WhatsApp Business

## Próximas ações
1. Revisar pricing dos planos
2. Definir metas por SDR
3. Criar playbook de onboarding`,
      type: "NOTE",
      priority: "NONE",
      dueDate: daysFromNow(30),
      isDone: false,
      workspaceId: workspace.id,
      columnId: colTodo.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 13,
    },
    {
      title: `${SEED_TAG} Deadline: Entrega do Projeto Apollo`,
      description: "Data limite para entrega do módulo de relatórios ao cliente Apollo Corp.",
      type: "TASK",
      priority: "URGENT",
      dueDate: daysFromNow(28),
      startDate: withHour(daysFromNow(28), 18),
      endDate: withHour(daysFromNow(28), 18),
      isDone: false,
      workspaceId: workspace.id,
      columnId: colTodo.id,
      createdBy: user.id,
      organizationId: organization.id,
      order: 14,
    },
  ];

  // ── 6. Insere os eventos ─────────────────────────────────────────────────
  let count = 0;
  for (const data of events) {
    await prisma.action.create({ data });
    count++;
  }

  console.log(`\n✅ ${count} eventos criados com sucesso no workspace "${workspace.name}"!`);
  console.log(`\n📌 Resumo:`);
  console.log(`   Usuário  : ${user.name ?? user.email}`);
  console.log(`   Org      : ${organization.name}`);
  console.log(`   Workspace: ${workspace.name} (${workspace.id})`);
  console.log(`   Colunas  : ${columns.map((c) => c.name).join(" | ")}`);
  console.log(`\n🎯 Acesse o workspace para visualizar os eventos no calendário!\n`);
}

main()
  .catch((e) => {
    console.error("❌ Erro ao rodar o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
