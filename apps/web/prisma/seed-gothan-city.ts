/**
 * Seed da org GOTHAN CITY (tema Batman 🦇).
 *
 * Popula dados realistas para testar:
 *   - Workspace + OrgProjects (clientes)
 *   - Tracking + Status + Leads + Tags
 *   - Forge (produtos + propostas)
 *   - Payment (conta + categorias + lançamentos)
 *
 * Idempotente — usa upsert/findFirst-then-create.
 *
 * Rode com:  npx tsx prisma/seed-gothan-city.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

const ORG_ID = "GHqaKGx2iD4Za5tnO8WzKbC8xUVBkPg0";
const OWNER_ID = "oWg8TLUUfm8H963mdBllNITnmEvermcI";

async function main() {
  console.log("🦇 Iniciando seed da Gothan City...");

  // ───────────────────────────────────────────────────────────────
  // 1. ORG PROJECTS (clientes Batman-themed)
  // ───────────────────────────────────────────────────────────────
  console.log("\n📁 Criando OrgProjects (clientes)...");
  const projectData = [
    {
      name: "Wayne Enterprises",
      type: "client",
      color: "#0F172A",
      slogan: "A Fortune 500 company",
      website: "https://wayne-enterprises.com",
      icp: "Conglomerados industriais",
    },
    {
      name: "Gotham PD",
      type: "client",
      color: "#1E40AF",
      slogan: "Protect and Serve",
      website: null,
      icp: "Setor público / segurança",
    },
    {
      name: "Iceberg Lounge",
      type: "client",
      color: "#0EA5E9",
      slogan: "Cool nights in Gotham",
      website: null,
      icp: "Hospitalidade premium",
    },
    {
      name: "Daily Planet",
      type: "client",
      color: "#DC2626",
      slogan: "Truth, Justice and Tomorrow",
      website: "https://dailyplanet.com",
      icp: "Mídia e jornalismo",
    },
    {
      name: "Arkham Asylum",
      type: "client",
      color: "#7C3AED",
      slogan: "Care and treatment",
      website: null,
      icp: "Saúde mental",
    },
  ];

  const projects: { id: string; name: string }[] = [];
  for (const p of projectData) {
    let existing = await prisma.orgProject.findFirst({
      where: { organizationId: ORG_ID, name: p.name },
    });
    if (!existing) {
      existing = await prisma.orgProject.create({
        data: {
          organizationId: ORG_ID,
          name: p.name,
          type: p.type,
          color: p.color,
          slogan: p.slogan ?? null,
          website: p.website ?? null,
          icp: p.icp ?? null,
        },
      });
    }
    projects.push({ id: existing.id, name: existing.name });
    console.log(`   ✔ ${p.name}`);
  }

  // ───────────────────────────────────────────────────────────────
  // 2. WORKSPACE com colunas
  // ───────────────────────────────────────────────────────────────
  console.log("\n🗂️  Criando Workspace...");
  let workspace = await prisma.workspace.findFirst({
    where: { organizationId: ORG_ID, name: "Operações Gotham" },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        organizationId: ORG_ID,
        createdBy: OWNER_ID,
        name: "Operações Gotham",
        description: "Workspace principal das operações.",
        color: "#0F172A",
        visibility: "ORGANIZATION",
      },
    });
  }

  const columnNames = ["A Fazer", "Em Patrulha", "Em Revisão", "Concluído"];
  for (let i = 0; i < columnNames.length; i++) {
    const exists = await prisma.workspaceColumn.findFirst({
      where: { workspaceId: workspace.id, name: columnNames[i] },
    });
    if (!exists) {
      await prisma.workspaceColumn.create({
        data: {
          workspaceId: workspace.id,
          name: columnNames[i],
          order: i,
          color: ["#94A3B8", "#1E40AF", "#F59E0B", "#22C55E"][i],
        },
      });
    }
  }
  // Garante que o owner é membro
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: OWNER_ID } },
    update: {},
    create: { workspaceId: workspace.id, userId: OWNER_ID, role: "OWNER" },
  });
  console.log(`   ✔ Workspace "${workspace.name}" com 4 colunas`);

  // ───────────────────────────────────────────────────────────────
  // 3. TRACKING + STATUS
  // ───────────────────────────────────────────────────────────────
  console.log("\n🎯 Criando Tracking de Vendas...");
  let tracking = await prisma.tracking.findFirst({
    where: { organizationId: ORG_ID, name: "Vendas Gotham" },
  });
  if (!tracking) {
    tracking = await prisma.tracking.create({
      data: {
        organizationId: ORG_ID,
        name: "Vendas Gotham",
        description: "Pipeline de oportunidades comerciais da Bat-corporação.",
      },
    });
  }

  const statusData = [
    { name: "Prospect", color: "#94A3B8", order: 1 },
    { name: "Contato Feito", color: "#3B82F6", order: 2 },
    { name: "Reunião", color: "#8B5CF6", order: 3 },
    { name: "Proposta", color: "#F59E0B", order: 4 },
    { name: "Negociação", color: "#EF4444", order: 5 },
    { name: "Fechado", color: "#22C55E", order: 6 },
  ];
  const statusByName: Record<string, string> = {};
  for (const s of statusData) {
    let st = await prisma.status.findFirst({
      where: { trackingId: tracking.id, name: s.name },
    });
    if (!st) {
      st = await prisma.status.create({
        data: {
          trackingId: tracking.id,
          name: s.name,
          color: s.color,
          order: s.order,
        },
      });
    }
    statusByName[s.name] = st.id;
  }
  console.log(`   ✔ Tracking "${tracking.name}" com 6 status`);

  // ───────────────────────────────────────────────────────────────
  // 4. TAGS
  // ───────────────────────────────────────────────────────────────
  console.log("\n🏷️  Criando Tags...");
  const tagData = [
    { name: "VIP", slug: "vip", color: "#F59E0B", icon: "⭐" },
    { name: "Quente", slug: "quente", color: "#EF4444", icon: "🔥" },
    { name: "Empresa", slug: "empresa", color: "#3B82F6", icon: "🏢" },
    { name: "Indicação", slug: "indicacao", color: "#22C55E", icon: "👥" },
    { name: "Inbound", slug: "inbound", color: "#8B5CF6", icon: "📥" },
  ];
  const tagByName: Record<string, string> = {};
  for (const t of tagData) {
    const tag = await prisma.tag.upsert({
      where: {
        slug_organizationId_trackingId: {
          slug: t.slug,
          organizationId: ORG_ID,
          trackingId: tracking.id,
        },
      },
      update: {},
      create: {
        organizationId: ORG_ID,
        trackingId: tracking.id,
        name: t.name,
        slug: t.slug,
        color: t.color,
        icon: t.icon,
      },
    });
    tagByName[t.name] = tag.id;
  }
  console.log(`   ✔ ${tagData.length} tags`);

  // ───────────────────────────────────────────────────────────────
  // 5. LEADS
  // ───────────────────────────────────────────────────────────────
  console.log("\n👥 Criando Leads...");
  const leadData = [
    {
      name: "Bruce Wayne",
      email: "bruce@wayne-enterprises.com",
      phone: "11999000001",
      status: "Negociação",
      amount: 250000,
      temperature: "VERY_HOT" as const,
      source: "DEFAULT" as const,
      project: "Wayne Enterprises",
      tags: ["VIP", "Quente", "Empresa"],
      description: "CEO interessado em pacote enterprise + suporte 24/7.",
    },
    {
      name: "Selina Kyle",
      email: "selina@catwoman.gt",
      phone: "11999000002",
      status: "Reunião",
      amount: 18000,
      temperature: "HOT" as const,
      source: "INSTAGRAM" as const,
      project: null,
      tags: ["Quente", "Inbound"],
      description: "Veio pelo Instagram, agendou demo.",
    },
    {
      name: "Harvey Dent",
      email: "h.dent@gotham.gov",
      phone: "11999000003",
      status: "Proposta",
      amount: 75000,
      temperature: "HOT" as const,
      source: "DEFAULT" as const,
      project: "Gotham PD",
      tags: ["Empresa", "VIP"],
      description: "Promotor avaliando proposta institucional.",
    },
    {
      name: "Oswald Cobblepot",
      email: "penguin@iceberg.gt",
      phone: "11999000004",
      status: "Contato Feito",
      amount: 32000,
      temperature: "WARM" as const,
      source: "WHATSAPP" as const,
      project: "Iceberg Lounge",
      tags: ["Empresa"],
      description: "Quer integração com sistema de reservas.",
    },
    {
      name: "Lois Lane",
      email: "lois@dailyplanet.com",
      phone: "11999000005",
      status: "Reunião",
      amount: 22000,
      temperature: "HOT" as const,
      source: "LINKEDIN" as const,
      project: "Daily Planet",
      tags: ["Inbound", "Quente"],
      description: "Editora interessada em automatizar pauta.",
    },
    {
      name: "Edward Nigma",
      email: "riddler@arkham.gt",
      phone: "11999000006",
      status: "Prospect",
      amount: 12000,
      temperature: "COLD" as const,
      source: "FORM" as const,
      project: "Arkham Asylum",
      tags: ["Inbound"],
      description: "Preencheu formulário, ainda não respondeu retorno.",
    },
    {
      name: "Pamela Isley",
      email: "ivy@gotham-bot.gt",
      phone: "11999000007",
      status: "Prospect",
      amount: 8000,
      temperature: "COLD" as const,
      source: "GOOGLE_MAPS" as const,
      project: null,
      tags: ["Indicação"],
      description: "Achou via Google Maps, indicou amiga.",
    },
    {
      name: "Diana Prince",
      email: "diana@themyscira.gt",
      phone: "11999000008",
      status: "Fechado",
      amount: 180000,
      temperature: "VERY_HOT" as const,
      source: "DEFAULT" as const,
      project: "Wayne Enterprises",
      tags: ["VIP", "Empresa"],
      description: "Contrato assinado — ticket alto.",
    },
    {
      name: "Barbara Gordon",
      email: "barb@gotham.gov",
      phone: "11999000009",
      status: "Negociação",
      amount: 45000,
      temperature: "HOT" as const,
      source: "DEFAULT" as const,
      project: "Gotham PD",
      tags: ["Empresa", "Indicação"],
      description: "Indicação interna, próxima de fechar.",
    },
    {
      name: "Dick Grayson",
      email: "dick@bludhaven.gt",
      phone: "11999000010",
      status: "Proposta",
      amount: 28000,
      temperature: "WARM" as const,
      source: "WHATSAPP" as const,
      project: null,
      tags: ["Inbound"],
      description: "Recebeu proposta esta semana.",
    },
    {
      name: "Clark Kent",
      email: "clark@dailyplanet.com",
      phone: "11999000011",
      status: "Contato Feito",
      amount: 15000,
      temperature: "WARM" as const,
      source: "LINKEDIN" as const,
      project: "Daily Planet",
      tags: ["Inbound"],
      description: "Repórter avaliando para uso pessoal.",
    },
    {
      name: "Jonathan Crane",
      email: "scarecrow@arkham.gt",
      phone: "11999000012",
      status: "Prospect",
      amount: 5000,
      temperature: "COLD" as const,
      source: "OTHER" as const,
      project: "Arkham Asylum",
      tags: [],
      description: "Lead frio, primeira abordagem.",
    },
  ];

  let leadCount = 0;
  let firstClosedLeadId: string | null = null;
  for (let i = 0; i < leadData.length; i++) {
    const l = leadData[i];
    const projectId = l.project ? projects.find((p) => p.name === l.project)?.id ?? null : null;
    const existing = await prisma.lead.findFirst({
      where: { trackingId: tracking.id, phone: l.phone },
    });
    let lead;
    if (!existing) {
      lead = await prisma.lead.create({
        data: {
          name: l.name,
          email: l.email,
          phone: l.phone,
          description: l.description,
          statusId: statusByName[l.status],
          trackingId: tracking.id,
          orgProjectId: projectId,
          responsibleId: OWNER_ID,
          source: l.source,
          temperature: l.temperature,
          amount: l.amount,
          order: i,
          currentAction: l.status === "Fechado" ? "WON" : "ACTIVE",
          closedAt: l.status === "Fechado" ? new Date() : null,
        },
      });
      leadCount++;
    } else {
      lead = existing;
    }
    if (l.status === "Fechado" && !firstClosedLeadId) firstClosedLeadId = lead.id;

    for (const tagName of l.tags) {
      const tagId = tagByName[tagName];
      if (tagId) {
        await prisma.leadTag.upsert({
          where: { leadId_tagId: { leadId: lead.id, tagId } },
          update: {},
          create: { leadId: lead.id, tagId },
        });
      }
    }
  }
  console.log(`   ✔ ${leadCount} novos leads criados (${leadData.length} total)`);

  // ───────────────────────────────────────────────────────────────
  // 6. FORGE — produtos + propostas
  // ───────────────────────────────────────────────────────────────
  console.log("\n⚒️  Criando produtos Forge...");
  const productData = [
    { name: "Bat-Suite Enterprise", sku: "BAT-ENT-001", value: 12000, unit: "mês", description: "Plano corporativo completo." },
    { name: "Plano Patrulha Pro", sku: "PAT-PRO-002", value: 4900, unit: "mês", description: "Para times médios." },
    { name: "Plano Sidekick", sku: "SDK-003", value: 1490, unit: "mês", description: "Para começar." },
    { name: "Setup & Onboarding", sku: "ONB-004", value: 8500, unit: "un", description: "Implantação assistida (one-time)." },
    { name: "Treinamento Wayne Tech", sku: "TRN-005", value: 3200, unit: "h", description: "Mentoria especializada por hora." },
    { name: "Suporte Premium 24/7", sku: "SUP-006", value: 2200, unit: "mês", description: "SLA agressivo, atendimento dedicado." },
  ];
  const products: { id: string; name: string; value: number }[] = [];
  for (const p of productData) {
    const prod = await prisma.forgeProduct.upsert({
      where: { organizationId_sku: { organizationId: ORG_ID, sku: p.sku } },
      update: { value: p.value, name: p.name, unit: p.unit, description: p.description },
      create: {
        organizationId: ORG_ID,
        createdById: OWNER_ID,
        name: p.name,
        sku: p.sku,
        value: p.value,
        unit: p.unit,
        description: p.description,
      },
    });
    products.push({ id: prod.id, name: prod.name, value: p.value });
  }
  console.log(`   ✔ ${products.length} produtos`);

  console.log("\n📄 Criando propostas Forge...");
  // Pega leads para vincular
  const someLeads = await prisma.lead.findMany({
    where: { trackingId: tracking.id },
    take: 4,
  });
  const proposalData = [
    { title: "Proposta Wayne Enterprise 2026", status: "ENVIADA" as const, leadIdx: 0, productSkus: ["BAT-ENT-001", "ONB-004", "SUP-006"] },
    { title: "Proposta Gotham PD - Patrulha Pro", status: "VISUALIZADA" as const, leadIdx: 1, productSkus: ["PAT-PRO-002", "TRN-005"] },
    { title: "Iceberg Lounge - Sidekick + Setup", status: "RASCUNHO" as const, leadIdx: 2, productSkus: ["SDK-003", "ONB-004"] },
    { title: "Daily Planet - Combo Mídia", status: "PAGA" as const, leadIdx: 3, productSkus: ["PAT-PRO-002", "SUP-006"] },
  ];

  // Pega o último número de proposta para evitar conflito
  const lastProposal = await prisma.forgeProposal.findFirst({
    where: { organizationId: ORG_ID },
    orderBy: { number: "desc" },
  });
  let nextNumber = (lastProposal?.number ?? 0) + 1;

  for (const pr of proposalData) {
    const existing = await prisma.forgeProposal.findFirst({
      where: { organizationId: ORG_ID, title: pr.title },
    });
    if (existing) continue;

    const lead = someLeads[pr.leadIdx];
    const prop = await prisma.forgeProposal.create({
      data: {
        organizationId: ORG_ID,
        createdById: OWNER_ID,
        responsibleId: OWNER_ID,
        title: pr.title,
        number: nextNumber++,
        status: pr.status,
        clientId: lead?.id ?? null,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: `Proposta gerada automaticamente para ${lead?.name ?? "cliente"}.`,
      },
    });
    let order = 0;
    for (const sku of pr.productSkus) {
      const product = products.find((x) => productData.find((pd) => pd.sku === sku)?.name === x.name);
      if (!product) continue;
      await prisma.forgeProposalProduct.create({
        data: {
          proposalId: prop.id,
          productId: product.id,
          quantity: 1,
          unitValue: product.value,
          order: order++,
        },
      });
    }
  }
  console.log(`   ✔ ${proposalData.length} propostas verificadas`);

  // ───────────────────────────────────────────────────────────────
  // 7. PAYMENT — conta + categorias + lançamentos
  // ───────────────────────────────────────────────────────────────
  console.log("\n💰 Criando Payment...");
  let bankAccount = await prisma.paymentBankAccount.findFirst({
    where: { organizationId: ORG_ID, name: "Conta Wayne Foundation" },
  });
  if (!bankAccount) {
    bankAccount = await prisma.paymentBankAccount.create({
      data: {
        organizationId: ORG_ID,
        name: "Conta Wayne Foundation",
        bankName: "Gotham National Bank",
        type: "CHECKING",
        balance: 0,
        isDefault: true,
        color: "#0F172A",
      },
    });
  }
  console.log(`   ✔ Conta: ${bankAccount.name}`);

  const categoryData = [
    { name: "Receita de Serviços", type: "REVENUE" as const, color: "#22C55E", icon: "💵" },
    { name: "Receita de Produtos", type: "REVENUE" as const, color: "#10B981", icon: "📦" },
    { name: "Folha de Pagamento", type: "EXPENSE" as const, color: "#EF4444", icon: "👥" },
    { name: "Marketing & Ads", type: "EXPENSE" as const, color: "#F59E0B", icon: "📣" },
    { name: "Infraestrutura", type: "COST" as const, color: "#3B82F6", icon: "🛰️" },
    { name: "Aluguel Bat-Cave", type: "EXPENSE" as const, color: "#7C3AED", icon: "🏢" },
  ];
  const catByName: Record<string, string> = {};
  for (const c of categoryData) {
    let cat = await prisma.paymentCategory.findFirst({
      where: { organizationId: ORG_ID, name: c.name },
    });
    if (!cat) {
      cat = await prisma.paymentCategory.create({
        data: { organizationId: ORG_ID, name: c.name, type: c.type, color: c.color, icon: c.icon },
      });
    }
    catByName[c.name] = cat.id;
  }
  console.log(`   ✔ ${categoryData.length} categorias`);

  // Lançamentos: misto de pagos e pendentes
  const today = new Date();
  const day = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d;
  };

  const entryData = [
    { description: "Plano enterprise — Wayne", amount: 1200000, type: "RECEIVABLE" as const, status: "PAID" as const, due: -10, cat: "Receita de Serviços" },
    { description: "Plano Pro — Daily Planet", amount: 490000, type: "RECEIVABLE" as const, status: "PAID" as const, due: -5, cat: "Receita de Serviços" },
    { description: "Plano Pro — Gotham PD", amount: 490000, type: "RECEIVABLE" as const, status: "PENDING" as const, due: 5, cat: "Receita de Serviços" },
    { description: "Setup Iceberg Lounge", amount: 850000, type: "RECEIVABLE" as const, status: "PARTIAL" as const, due: 10, cat: "Receita de Produtos", paid: 425000 },
    { description: "Mentoria Wayne Tech", amount: 320000, type: "RECEIVABLE" as const, status: "PENDING" as const, due: 15, cat: "Receita de Serviços" },
    { description: "Folha — Maio", amount: 950000, type: "PAYABLE" as const, status: "PAID" as const, due: -2, cat: "Folha de Pagamento" },
    { description: "Google Ads — Maio", amount: 180000, type: "PAYABLE" as const, status: "PAID" as const, due: -1, cat: "Marketing & Ads" },
    { description: "Servidores AWS", amount: 220000, type: "PAYABLE" as const, status: "PENDING" as const, due: 7, cat: "Infraestrutura" },
    { description: "Aluguel Bat-Cave", amount: 380000, type: "PAYABLE" as const, status: "OVERDUE" as const, due: -3, cat: "Aluguel Bat-Cave" },
    { description: "Folha — Junho (preview)", amount: 950000, type: "PAYABLE" as const, status: "PENDING" as const, due: 28, cat: "Folha de Pagamento" },
  ];

  let entryCount = 0;
  for (const e of entryData) {
    const exists = await prisma.paymentEntry.findFirst({
      where: {
        organizationId: ORG_ID,
        description: e.description,
        amount: e.amount,
      },
    });
    if (!exists) {
      await prisma.paymentEntry.create({
        data: {
          organizationId: ORG_ID,
          createdById: OWNER_ID,
          accountId: bankAccount.id,
          categoryId: catByName[e.cat] ?? null,
          description: e.description,
          amount: e.amount,
          type: e.type,
          status: e.status,
          dueDate: day(e.due),
          paidAt: e.status === "PAID" || e.status === "PARTIAL" ? day(e.due) : null,
          paidAmount: e.status === "PAID" ? e.amount : (e as any).paid ?? 0,
        },
      });
      entryCount++;
    }
  }
  console.log(`   ✔ ${entryCount} novos lançamentos (${entryData.length} total)`);

  // ───────────────────────────────────────────────────────────────
  // 8. LINNKER — página + links
  // ───────────────────────────────────────────────────────────────
  console.log("\n🔗 Criando Linnker page...");
  const linnkerSlug = `gothan-city-${ORG_ID.slice(-6).toLowerCase()}`;
  let linnker = await prisma.linnkerPage.findFirst({
    where: { organizationId: ORG_ID, slug: linnkerSlug },
  });
  if (!linnker) {
    linnker = await prisma.linnkerPage.create({
      data: {
        organizationId: ORG_ID,
        userId: OWNER_ID,
        slug: linnkerSlug,
        title: "Gothan City Agency",
        bio: "A agência que protege Gotham 24/7.",
        coverColor: "#0F172A",
        isPublished: true,
      },
    });
  }
  const linkData = [
    { title: "Site oficial", url: "https://wayne-enterprises.com", emoji: "🌐", position: 0 },
    { title: "Agendar reunião", url: "https://cal.com/gothan", emoji: "📅", position: 1 },
    { title: "WhatsApp comercial", url: "https://wa.me/5511999000001", emoji: "💬", position: 2 },
    { title: "Instagram", url: "https://instagram.com/gothancity", emoji: "📸", position: 3 },
  ];
  for (const lk of linkData) {
    const exists = await prisma.linnkerLink.findFirst({
      where: { pageId: linnker.id, title: lk.title },
    });
    if (!exists) {
      await prisma.linnkerLink.create({
        data: {
          pageId: linnker.id,
          title: lk.title,
          url: lk.url,
          emoji: lk.emoji,
          position: lk.position,
          type: "EXTERNAL",
        },
      });
    }
  }
  console.log(`   ✔ Página Linnker /${linnkerSlug} com ${linkData.length} links`);

  // ───────────────────────────────────────────────────────────────
  // 9. AGENDA + alguns appointments
  // ───────────────────────────────────────────────────────────────
  console.log("\n📅 Criando Agenda...");
  const agendaSlug = "consultoria-gotham";
  let agenda = await prisma.agenda.findFirst({
    where: { organizationId: ORG_ID, slug: agendaSlug },
  });
  if (!agenda) {
    agenda = await prisma.agenda.create({
      data: {
        organizationId: ORG_ID,
        trackingId: tracking.id,
        name: "Consultoria Gotham",
        description: "Reuniões 1:1 com o time comercial.",
        slug: agendaSlug,
        slotDuration: 30,
      },
    });
  }
  await prisma.agendaResponsible.upsert({
    where: { agendaId_userId: { agendaId: agenda.id, userId: OWNER_ID } },
    update: {},
    create: { agendaId: agenda.id, userId: OWNER_ID },
  });

  // Disponibilidade Seg-Sex 9h-18h
  const days: any[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
  for (const d of days) {
    const av = await prisma.agendaAvailability.upsert({
      where: { agendaId_dayOfWeek: { agendaId: agenda.id, dayOfWeek: d } },
      update: {},
      create: { agendaId: agenda.id, dayOfWeek: d, isActive: true },
    });
    const slotExists = await prisma.availabilityTimeSlot.findFirst({
      where: { availabilityId: av.id, startTime: "09:00" },
    });
    if (!slotExists) {
      await prisma.availabilityTimeSlot.create({
        data: { availabilityId: av.id, startTime: "09:00", endTime: "18:00", order: 0 },
      });
    }
  }

  // 3 appointments futuros
  const aptData = [
    { title: "Reunião com Bruce Wayne", offsetDays: 1, leadIdx: 0 },
    { title: "Demo Daily Planet", offsetDays: 3, leadIdx: 4 },
    { title: "Follow-up Iceberg", offsetDays: 5, leadIdx: 3 },
  ];
  for (const a of aptData) {
    const exists = await prisma.appointment.findFirst({
      where: { agendaId: agenda.id, title: a.title },
    });
    if (!exists) {
      const startsAt = new Date();
      startsAt.setDate(startsAt.getDate() + a.offsetDays);
      startsAt.setHours(10, 0, 0, 0);
      const endsAt = new Date(startsAt);
      endsAt.setMinutes(30);
      await prisma.appointment.create({
        data: {
          agendaId: agenda.id,
          trackingId: tracking.id,
          leadId: someLeads[a.leadIdx]?.id,
          userId: OWNER_ID,
          title: a.title,
          startsAt,
          endsAt,
          status: "CONFIRMED",
        },
      });
    }
  }
  console.log(`   ✔ Agenda /${agendaSlug} (Seg-Sex 9h-18h) + 3 appointments`);

  console.log("\n✅ Seed Gothan City finalizado com sucesso! 🦇\n");
  console.log("Resumo:");
  console.log(`   • ${projects.length} clientes (OrgProjects)`);
  console.log(`   • 1 workspace + ${columnNames.length} colunas`);
  console.log(`   • 1 tracking + ${statusData.length} status + ${tagData.length} tags`);
  console.log(`   • ${leadData.length} leads`);
  console.log(`   • ${products.length} produtos Forge + ${proposalData.length} propostas`);
  console.log(`   • 1 conta + ${categoryData.length} categorias + ${entryData.length} lançamentos`);
  console.log(`   • 1 página Linnker + ${linkData.length} links`);
  console.log(`   • 1 agenda + 3 appointments`);
}

main()
  .catch((e) => {
    console.error("\n❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
