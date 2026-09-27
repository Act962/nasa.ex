import "./load-env";
import prisma from "../../src/lib/prisma";
import { QA_ORG_NAME, QA_ORG_SLUG, assertQaOrg } from "./qa-org";
import { brazilDateTime, nextBrazilWeekday } from "./brazil-time";

// Massa de dados da bateria (docs/astro-bateria-de-testes.md §4).
// Uso: pnpm tsx --conditions=react-server scripts/astro-qa/seed.ts --owner <email>
// Sempre recria a massa do zero dentro da org de QA; nada fora dela é tocado.

const VENDAS_STATUSES = ["Novo", "Qualificado", "Proposta", "Ganho", "Perdido"];
const SUPORTE_STATUSES = ["Aberto", "Resolvido"];
const TAG_NAMES = ["Quente", "Frio", "Indicação"];

interface SeedLead {
  name: string;
  status: string;
  phone: string;
  email?: string;
  hasResponsible: boolean;
  tags?: string[];
}

const VENDAS_LEADS: SeedLead[] = [
  { name: "Kauê Silva", status: "Novo", phone: "5586900000001", hasResponsible: true, tags: ["Quente"] },
  { name: "Kauê Souza", status: "Qualificado", phone: "5586900000002", hasResponsible: true },
  { name: "Maria Clara", status: "Proposta", phone: "5586900000003", email: "maria.clara@qa.test", hasResponsible: true, tags: ["Indicação"] },
  { name: "João Pedro", status: "Novo", phone: "5586900000004", hasResponsible: false },
  { name: "Maria Eduarda", status: "Novo", phone: "5586900000006", hasResponsible: true },
  { name: "Ana Beatriz", status: "Ganho", phone: "5586900000005", hasResponsible: true, tags: ["Quente"] },
  ...Array.from({ length: 15 }, (_, index) => ({
    name: `Lead QA ${String(index + 1).padStart(2, "0")}`,
    status: VENDAS_STATUSES[index % VENDAS_STATUSES.length],
    phone: `55869000001${String(index).padStart(2, "0")}`,
    hasResponsible: true,
    tags: index % 3 === 0 ? ["Frio"] : undefined,
  })),
];

const SUPORTE_LEADS: SeedLead[] = [
  { name: "Cliente Suporte 01", status: "Aberto", phone: "5586900000201", hasResponsible: true },
  { name: "Cliente Suporte 02", status: "Aberto", phone: "5586900000202", hasResponsible: true },
  { name: "Cliente Suporte 03", status: "Resolvido", phone: "5586900000203", hasResponsible: true },
];

const KNOWLEDGE_CONTENT = [
  "## Implantação do ÓRBITA",
  "O prazo padrão de implantação é de 21 dias corridos, contados da assinatura.",
  "",
  "## Suporte",
  "O suporte funciona de segunda a sexta, das 8h às 18h, e o primeiro retorno acontece em até 4 horas úteis.",
].join("\n");

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readOwnerEmail(): string {
  const flagIndex = process.argv.indexOf("--owner");
  const email = flagIndex >= 0 ? process.argv[flagIndex + 1] : process.env.ASTRO_QA_OWNER_EMAIL;
  if (!email) throw new Error("Informe o dono da org de QA: --owner <email> (ou ASTRO_QA_OWNER_EMAIL).");
  return email;
}

async function ensureQaOrg(ownerUserId: string): Promise<string> {
  const existing = await prisma.organization.findUnique({
    where: { slug: QA_ORG_SLUG },
    select: { id: true },
  });
  const organizationId =
    existing?.id ??
    (
      await prisma.organization.create({
        data: { name: QA_ORG_NAME, slug: QA_ORG_SLUG, createdAt: new Date() },
        select: { id: true },
      })
    ).id;

  const membership = await prisma.member.findFirst({
    where: { organizationId, userId: ownerUserId },
    select: { id: true },
  });
  if (!membership) {
    await prisma.member.create({
      data: { organizationId, userId: ownerUserId, role: "owner", createdAt: new Date() },
    });
  }
  return organizationId;
}

/** Produtos e propostas da massa (§4). Recriados inteiros por quem mexe neles. */
export async function clearForgeData(organizationId: string): Promise<void> {
  await assertQaOrg(organizationId);
  await prisma.forgeProposalProduct.deleteMany({ where: { proposal: { organizationId } } });
  await prisma.forgeProposal.deleteMany({ where: { organizationId } });
  await prisma.forgeProduct.deleteMany({ where: { organizationId } });
}

export async function seedForgeData(organizationId: string, ownerUserId: string): Promise<void> {
  const [consultoria, setup] = await Promise.all([
    prisma.forgeProduct.create({
      data: { organizationId, name: "Consultoria", sku: "QA-CONSULTORIA", value: 2000, createdById: ownerUserId },
      select: { id: true },
    }),
    prisma.forgeProduct.create({
      data: { organizationId, name: "Setup (Única)", sku: "QA-SETUP", value: 500, createdById: ownerUserId },
      select: { id: true },
    }),
  ]);
  const clients = await prisma.lead.findMany({
    where: { tracking: { organizationId }, name: { in: ["Maria Clara", "Kauê Silva"] } },
    select: { id: true, name: true },
  });
  const clientIdByName = new Map(clients.map((client) => [client.name, client.id]));
  const proposals = [
    { number: 1, title: "Proposta - Maria Clara", clientName: "Maria Clara", status: "ENVIADA" as const, items: [{ productId: consultoria.id, unitValue: 2000 }] },
    { number: 2, title: "Proposta - Maria Clara (rascunho)", clientName: "Maria Clara", status: "RASCUNHO" as const, items: [{ productId: setup.id, unitValue: 500 }] },
    { number: 3, title: "Proposta - Kauê Silva", clientName: "Kauê Silva", status: "RASCUNHO" as const, items: [] },
  ];
  for (const proposal of proposals) {
    await prisma.forgeProposal.create({
      data: {
        organizationId,
        number: proposal.number,
        title: proposal.title,
        status: proposal.status,
        clientId: clientIdByName.get(proposal.clientName) ?? null,
        responsibleId: ownerUserId,
        createdById: ownerUserId,
        participants: [],
        products: {
          create: proposal.items.map((item, index) => ({ ...item, quantity: 1, order: index })),
        },
      },
    });
  }
}

/** Contas, categorias e lançamentos (§4). Recriados inteiros por quem mexe neles. */
export async function clearFinanceData(organizationId: string): Promise<void> {
  await assertQaOrg(organizationId);
  await prisma.paymentEntry.deleteMany({ where: { organizationId } });
  await prisma.paymentCategory.deleteMany({ where: { organizationId } });
  await prisma.paymentBankAccount.deleteMany({ where: { organizationId } });
  await prisma.paymentAccess.deleteMany({ where: { organizationId } });
}

export async function seedFinanceData(organizationId: string, ownerUserId: string): Promise<void> {
  // O financeiro tem matriz de acesso própria: sem esta linha, o dono da org
  // de QA recebe "sem acesso ao módulo financeiro".
  await prisma.paymentAccess.create({
    data: { organizationId, userId: ownerUserId, role: "OWNER", isAuthorized: true, authorizedById: ownerUserId },
  });
  const [caixa] = await Promise.all([
    prisma.paymentBankAccount.create({ data: { organizationId, name: "Caixa" }, select: { id: true } }),
    prisma.paymentBankAccount.create({ data: { organizationId, name: "Banco" }, select: { id: true } }),
  ]);
  await prisma.paymentCategory.createMany({
    data: [
      { organizationId, name: "Operacional", type: "EXPENSE" },
      { organizationId, name: "Marketing", type: "EXPENSE" },
      { organizationId, name: "Vendas", type: "REVENUE" },
    ],
  });
  const operacional = await prisma.paymentCategory.findFirstOrThrow({
    where: { organizationId, name: "Operacional" },
    select: { id: true },
  });
  const entries = [
    { description: "Conta de internet", type: "PAYABLE" as const, amount: 15000, dayOffset: 0, isPaid: false },
    { description: "Aluguel", type: "PAYABLE" as const, amount: 200000, dayOffset: -5, isPaid: false },
    { description: "Energia", type: "PAYABLE" as const, amount: 30000, dayOffset: -2, isPaid: true, categoryId: operacional.id },
    { description: "Consultoria Maria Clara", type: "RECEIVABLE" as const, amount: 200000, dayOffset: 3, isPaid: false },
    { description: "Setup Kauê", type: "RECEIVABLE" as const, amount: 50000, dayOffset: -1, isPaid: true },
  ];
  await prisma.paymentEntry.createMany({
    data: entries.map((entry) => ({
      organizationId,
      type: entry.type,
      description: entry.description,
      amount: entry.amount,
      dueDate: brazilDateTime(entry.dayOffset, 12),
      accountId: caixa.id,
      categoryId: "categoryId" in entry ? entry.categoryId : null,
      createdById: ownerUserId,
      status: entry.isPaid ? ("PAID" as const) : entry.dayOffset < 0 ? ("OVERDUE" as const) : ("PENDING" as const),
      paidAmount: entry.isPaid ? entry.amount : 0,
      paidAt: entry.isPaid ? new Date() : null,
    })),
  });
}

/** Workspaces, colunas e tarefas (§4). */
export async function clearWorkspaceData(organizationId: string): Promise<void> {
  await assertQaOrg(organizationId);
  await prisma.action.deleteMany({ where: { workspace: { organizationId } } });
  await prisma.workspaceColumn.deleteMany({ where: { workspace: { organizationId } } });
  await prisma.workspaceMember.deleteMany({ where: { workspace: { organizationId } } });
  await prisma.workspace.deleteMany({ where: { organizationId } });
}

export async function seedWorkspaceData(organizationId: string, ownerUserId: string): Promise<void> {
  const operacao = await prisma.workspace.create({
    data: { name: "Operação", organizationId, createdBy: ownerUserId },
    select: { id: true },
  });
  await prisma.workspace.create({ data: { name: "Marketing", organizationId, createdBy: ownerUserId } });
  await prisma.workspaceMember.create({ data: { workspaceId: operacao.id, userId: ownerUserId, role: "OWNER" } });
  const columnIds: string[] = [];
  for (const [index, name] of ["A fazer", "Fazendo", "Feito"].entries()) {
    const column = await prisma.workspaceColumn.create({
      data: { name, workspaceId: operacao.id, order: index },
      select: { id: true },
    });
    columnIds.push(column.id);
  }
  const tasks = [
    { title: "Enviar relatório QA", dayOffset: 3, columnIndex: 0, isDone: false },
    { title: "Ligar para fornecedor QA", dayOffset: 5, columnIndex: 0, isDone: false },
    { title: "Pagar boleto QA", dayOffset: -2, columnIndex: 1, isDone: false },
    { title: "Revisar proposta QA", dayOffset: 0, columnIndex: 1, isDone: false },
    { title: "Organizar arquivos QA", dayOffset: -7, columnIndex: 2, isDone: true },
  ];
  for (const [index, task] of tasks.entries()) {
    await prisma.action.create({
      data: {
        title: task.title,
        workspaceId: operacao.id,
        columnId: columnIds[task.columnIndex],
        organizationId,
        createdBy: ownerUserId,
        dueDate: brazilDateTime(task.dayOffset, 18),
        isDone: task.isDone,
        order: index,
        responsibles: { create: { userId: ownerUserId } },
      },
    });
  }
}

/** Conversas, mensagens e formulários (§4). Sem WhatsApp conectado: nada sai daqui. */
export async function clearChatAndFormData(organizationId: string): Promise<void> {
  await assertQaOrg(organizationId);
  await prisma.message.deleteMany({ where: { conversation: { tracking: { organizationId } } } });
  await prisma.conversation.deleteMany({ where: { tracking: { organizationId } } });
  await prisma.form.deleteMany({ where: { organizationId } });
}

export async function seedChatAndFormData(organizationId: string, ownerUserId: string): Promise<void> {
  const leads = await prisma.lead.findMany({
    where: { tracking: { organizationId }, name: { in: ["Maria Clara", "Kauê Silva", "João Pedro"] } },
    select: { id: true, name: true, phone: true, trackingId: true },
  });
  for (const [index, lead] of leads.entries()) {
    const conversation = await prisma.conversation.create({
      data: { leadId: lead.id, trackingId: lead.trackingId, remoteJid: `${lead.phone}@s.whatsapp.net` },
      select: { id: true },
    });
    await prisma.message.createMany({
      data: [
        // Meia hora atrás: o lead está esperando resposta (F2-04).
        { conversationId: conversation.id, messageId: `qa-${lead.id}-1`, body: `Olá, aqui é ${lead.name}.`, fromMe: false, seen: false, createdAt: new Date(Date.now() - 31 * 60_000) },
        { conversationId: conversation.id, messageId: `qa-${lead.id}-2`, body: `Pode me mandar o orçamento? (${index + 1})`, fromMe: false, seen: false, createdAt: new Date(Date.now() - 30 * 60_000) },
      ],
    });
  }
  await prisma.form.createMany({
    data: [
      { organizationId, userId: ownerUserId, name: "Contato do site", content: "[]", published: true, shareUrl: `qa-contato-${organizationId}` },
      { organizationId, userId: ownerUserId, name: "Pesquisa NPS", content: "[]", published: false, shareUrl: `qa-nps-${organizationId}` },
    ],
  });
}

/** Apaga a massa anterior, sempre restrito à org de QA. */
export async function clearQaData(organizationId: string): Promise<void> {
  await assertQaOrg(organizationId);
  await clearForgeData(organizationId);
  await clearFinanceData(organizationId);
  await clearWorkspaceData(organizationId);
  await clearChatAndFormData(organizationId);
  const trackings = await prisma.tracking.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const trackingIds = trackings.map((tracking) => tracking.id);

  await prisma.appointment.deleteMany({ where: { agenda: { organizationId } } });
  await prisma.agenda.deleteMany({ where: { organizationId } });
  await prisma.reminder.deleteMany({ where: { trackingId: { in: trackingIds } } });
  await prisma.leadTag.deleteMany({ where: { lead: { trackingId: { in: trackingIds } } } });
  await prisma.lead.deleteMany({ where: { trackingId: { in: trackingIds } } });
  await prisma.tag.deleteMany({ where: { organizationId } });
  await prisma.status.deleteMany({ where: { trackingId: { in: trackingIds } } });
  await prisma.trackingParticipant.deleteMany({ where: { trackingId: { in: trackingIds } } });
  await prisma.tracking.deleteMany({ where: { organizationId } });
  await prisma.aiKnowledge.deleteMany({ where: { organizationId } });
  await prisma.astroMemory.deleteMany({ where: { organizationId } });
  await prisma.astroFeedback.deleteMany({ where: { organizationId } });
  await prisma.aiSession.deleteMany({ where: { organizationId } });
}

async function createTracking(params: {
  organizationId: string;
  ownerUserId: string;
  name: string;
  statusNames: string[];
  leads: SeedLead[];
  tagIdsByName: Map<string, string>;
}): Promise<string> {
  const tracking = await prisma.tracking.create({
    data: { name: params.name, organizationId: params.organizationId },
    select: { id: true },
  });
  await prisma.trackingParticipant.create({
    data: { trackingId: tracking.id, userId: params.ownerUserId, role: "OWNER" },
  });

  const statusIdsByName = new Map<string, string>();
  for (const [index, statusName] of params.statusNames.entries()) {
    const status = await prisma.status.create({
      data: { name: statusName, trackingId: tracking.id, order: index },
      select: { id: true },
    });
    statusIdsByName.set(statusName, status.id);
  }

  for (const [index, seedLead] of params.leads.entries()) {
    const lead = await prisma.lead.create({
      data: {
        name: seedLead.name,
        phone: seedLead.phone,
        email: seedLead.email ?? null,
        trackingId: tracking.id,
        statusId: statusIdsByName.get(seedLead.status)!,
        responsibleId: seedLead.hasResponsible ? params.ownerUserId : null,
        order: index,
      },
      select: { id: true },
    });
    for (const tagName of seedLead.tags ?? []) {
      await prisma.leadTag.create({
        data: { leadId: lead.id, tagId: params.tagIdsByName.get(tagName)! },
      });
    }
  }
  return tracking.id;
}

export async function seedQaData(organizationId: string, ownerUserId: string): Promise<void> {
  const tagIdsByName = new Map<string, string>();
  for (const tagName of TAG_NAMES) {
    const tag = await prisma.tag.create({
      data: { name: tagName, slug: slugify(tagName), organizationId },
      select: { id: true },
    });
    tagIdsByName.set(tagName, tag.id);
  }

  const vendasTrackingId = await createTracking({
    organizationId,
    ownerUserId,
    name: "Vendas",
    statusNames: VENDAS_STATUSES,
    leads: VENDAS_LEADS,
    tagIdsByName,
  });
  const suporteTrackingId = await createTracking({
    organizationId,
    ownerUserId,
    name: "Suporte",
    statusNames: SUPORTE_STATUSES,
    leads: SUPORTE_LEADS,
    tagIdsByName,
  });

  const comercialAgenda = await prisma.agenda.create({
    data: {
      name: "Agenda Comercial",
      slug: "agenda-comercial",
      organizationId,
      trackingId: vendasTrackingId,
    },
    select: { id: true },
  });
  await prisma.agenda.create({
    data: {
      name: "Agenda Suporte",
      slug: "agenda-suporte",
      organizationId,
      trackingId: suporteTrackingId,
    },
  });

  const mariaClaraId = (
    await prisma.lead.findFirstOrThrow({
      where: { trackingId: vendasTrackingId, name: "Maria Clara" },
      select: { id: true },
    })
  ).id;
  const todayMeeting = brazilDateTime(0, 16);
  const tomorrowVisit = brazilDateTime(1, 10);
  await prisma.appointment.createMany({
    data: [
      {
        title: "Reunião QA de hoje",
        startsAt: todayMeeting,
        endsAt: new Date(todayMeeting.getTime() + 60 * 60_000),
        agendaId: comercialAgenda.id,
        userId: ownerUserId,
      },
      {
        title: "Visita QA de amanhã",
        leadId: mariaClaraId,
        startsAt: tomorrowVisit,
        endsAt: new Date(tomorrowVisit.getTime() + 60 * 60_000),
        agendaId: comercialAgenda.id,
        userId: ownerUserId,
      },
    ],
  });

  // Sem evento no Inngest de propósito: o lembrete existe para a consulta,
  // não para disparar.
  await prisma.reminder.create({
    data: {
      createdByUserId: ownerUserId,
      message: "Revisar o funil QA",
      recurrenceType: "WEEKLY",
      remindTime: "09:00",
      nextRemindAt: nextBrazilWeekday(1, 9),
      trackingId: vendasTrackingId,
    },
  });

  await seedForgeData(organizationId, ownerUserId);
  await seedFinanceData(organizationId, ownerUserId);
  await seedWorkspaceData(organizationId, ownerUserId);
  await seedChatAndFormData(organizationId, ownerUserId);

  await prisma.aiKnowledge.create({
    data: {
      organizationId,
      name: "Produtos e prazos",
      type: "md",
      status: "READY",
      content: KNOWLEDGE_CONTENT,
      createdBy: ownerUserId,
    },
  });
  await prisma.astroMemory.create({
    data: {
      organizationId,
      kind: "RULE",
      content: "Desconto máximo de 10% sem aprovação do dono.",
      status: "ACTIVE",
      source: "MANUAL",
      createdById: ownerUserId,
      approvedById: ownerUserId,
    },
  });
}

async function main() {
  const ownerEmail = readOwnerEmail();
  const owner = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });
  if (!owner) throw new Error(`Usuário ${ownerEmail} não encontrado.`);

  const organizationId = await ensureQaOrg(owner.id);
  await clearQaData(organizationId);
  await seedQaData(organizationId, owner.id);
  console.log(`Massa de QA pronta na org "${QA_ORG_NAME}" (${organizationId}).`);
}

if (process.argv[1]?.endsWith("seed.ts")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
