/**
 * Seed de Clientes, Projetos e Leads — e vínculos com as ações [SEED] existentes.
 *
 * Objetivo: popular `OrgProject` (mix de "client" e "project") e `Lead` para a
 * organização ativa do usuário, e re-editar as 15 ações [SEED] criadas pelo
 * `seed-workspace-calendar-actions.ts` para que algumas fiquem vinculadas a
 * clientes, outras a projetos, outras a leads e outras sem vínculo nenhum
 * (para dar contraste nos filtros do Calendário Workspace).
 *
 * Uso:
 *   npx tsx scripts/seed-clients-projects-leads.ts
 *
 * Idempotente para `OrgProject` e `Lead` (upsert por nome+org). As ações são
 * sempre re-editadas para refletir a distribuição definida abaixo.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const USER_EMAIL = process.env.SEED_USER_EMAIL ?? "batman@gmail.com";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
} as any);
const prisma = new PrismaClient({ adapter } as any);

// ─── Catálogos ─────────────────────────────────────────────────────────────

const CLIENTS = [
  { name: "Wayne Enterprises", color: "#0ea5e9", slogan: "Building a brighter future" },
  { name: "Stark Industries", color: "#ef4444", slogan: "Tomorrow, today" },
  { name: "Daily Planet", color: "#f59e0b", slogan: "Truth, justice, and a great story" },
];

const PROJECTS = [
  { name: "Batmobile v3", color: "#7c3aed", description: "Próxima geração do Batmóvel" },
  { name: "Gotham Watch", color: "#10b981", description: "Sistema de patrulhamento da cidade" },
  { name: "Arkham Insights", color: "#ec4899", description: "Análise comportamental de vilões" },
];

const LEADS = [
  { name: "Selina Kyle", email: "selina@catwoman.gc", phone: "+55 11 91234-0001" },
  { name: "Edward Nigma", email: "riddler@enigma.gc", phone: "+55 11 91234-0002" },
  { name: "Harvey Dent", email: "harvey@dadc.gc", phone: "+55 11 91234-0003" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

async function ensureTracking(orgId: string) {
  // Procura tracking não-arquivado da org. Se não houver, cria um simples.
  let tracking = await prisma.tracking.findFirst({
    where: { organizationId: orgId, isArchived: false },
    select: { id: true, name: true, status: { select: { id: true }, take: 1 } },
  });

  if (tracking && tracking.status[0]) {
    return { trackingId: tracking.id, statusId: tracking.status[0].id };
  }

  if (!tracking) {
    tracking = await prisma.tracking.create({
      data: {
        name: "Pipeline Geral",
        organizationId: orgId,
      },
      select: { id: true, name: true, status: { select: { id: true }, take: 1 } },
    });
    console.log(`  ↳ tracking criado: ${tracking.name} (${tracking.id})`);
  }

  // Garante pelo menos um Status para o pipeline
  let statusId = tracking.status[0]?.id;
  if (!statusId) {
    const status = await prisma.status.create({
      data: {
        name: "Novo Lead",
        color: "#7c3aed",
        order: 0,
        trackingId: tracking.id,
      },
    });
    statusId = status.id;
    console.log(`  ↳ status criado: Novo Lead (${statusId})`);
  }

  return { trackingId: tracking.id, statusId };
}

async function main() {
  // 1. User + Org
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, name: true },
  });
  if (!user) throw new Error(`Usuário não encontrado: ${USER_EMAIL}`);

  const member = await prisma.member.findFirst({
    where: { userId: user.id },
    select: {
      organizationId: true,
      organization: { select: { id: true, name: true } },
    },
  });
  if (!member) throw new Error("Usuário sem organização");

  console.log(`✓ User: ${user.name} (${user.id})`);
  console.log(`✓ Org : ${member.organization.name} (${member.organizationId})`);

  const orgId = member.organizationId;

  // 2. Garantir tracking + status (necessário para Lead)
  const { trackingId, statusId } = await ensureTracking(orgId);
  console.log(`✓ Tracking: ${trackingId}  | Status: ${statusId}`);

  // 3. Upsert Clientes
  const clientRecords = await Promise.all(
    CLIENTS.map(async (c) => {
      const existing = await prisma.orgProject.findFirst({
        where: { organizationId: orgId, name: c.name, type: "client" },
        select: { id: true },
      });
      if (existing) {
        await prisma.orgProject.update({
          where: { id: existing.id },
          data: { color: c.color, slogan: c.slogan },
        });
        return { id: existing.id, name: c.name };
      }
      const created = await prisma.orgProject.create({
        data: {
          organizationId: orgId,
          name: c.name,
          type: "client",
          color: c.color,
          slogan: c.slogan,
          isActive: true,
        },
        select: { id: true, name: true },
      });
      return created;
    }),
  );
  console.log(`✓ Clientes:`, clientRecords.map((c) => c.name).join(", "));

  // 4. Upsert Projetos
  const projectRecords = await Promise.all(
    PROJECTS.map(async (p) => {
      const existing = await prisma.orgProject.findFirst({
        where: { organizationId: orgId, name: p.name, type: "project" },
        select: { id: true },
      });
      if (existing) {
        await prisma.orgProject.update({
          where: { id: existing.id },
          data: { color: p.color, description: p.description },
        });
        return { id: existing.id, name: p.name };
      }
      const created = await prisma.orgProject.create({
        data: {
          organizationId: orgId,
          name: p.name,
          type: "project",
          color: p.color,
          description: p.description,
          isActive: true,
        },
        select: { id: true, name: true },
      });
      return created;
    }),
  );
  console.log(`✓ Projetos:`, projectRecords.map((p) => p.name).join(", "));

  // 5. Upsert Leads (vinculados ao tracking + status)
  const leadRecords = await Promise.all(
    LEADS.map(async (l) => {
      const existing = await prisma.lead.findFirst({
        where: { trackingId, name: l.name },
        select: { id: true },
      });
      if (existing) {
        await prisma.lead.update({
          where: { id: existing.id },
          data: { email: l.email, phone: l.phone },
        });
        return { id: existing.id, name: l.name };
      }
      const created = await prisma.lead.create({
        data: {
          name: l.name,
          email: l.email,
          phone: l.phone,
          trackingId,
          statusId,
        },
        select: { id: true, name: true },
      });
      return created;
    }),
  );
  console.log(`✓ Leads:`, leadRecords.map((l) => l.name).join(", "));

  // 6. Buscar ações [SEED] existentes (criadas pelo seed-workspace-calendar-actions)
  const seedActions = await prisma.action.findMany({
    where: {
      organizationId: orgId,
      title: { startsWith: "[SEED]" },
      isArchived: false,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true },
  });

  if (seedActions.length === 0) {
    console.log(
      "⚠  Nenhuma ação [SEED] encontrada. Rode primeiro:\n   npx tsx scripts/seed-workspace-calendar-actions.ts",
    );
    return;
  }
  console.log(`✓ ${seedActions.length} ações [SEED] encontradas para vincular`);

  // 7. Distribuir vínculos: roda i % 4 →
  //    0 = cliente   (orgProjectId = client)
  //    1 = projeto   (orgProjectId = project)
  //    2 = lead      (leadId, sem orgProject — para testar fallback amber)
  //    3 = sem vínculo (limpa tudo)
  let counts = { client: 0, project: 0, lead: 0, none: 0 };
  for (let i = 0; i < seedActions.length; i++) {
    const a = seedActions[i];
    const bucket = i % 4;
    let data: {
      orgProjectId: string | null;
      leadId: string | null;
      trackingId: string | null;
    };

    if (bucket === 0) {
      const c = clientRecords[i % clientRecords.length];
      data = { orgProjectId: c.id, leadId: null, trackingId: null };
      counts.client++;
    } else if (bucket === 1) {
      const p = projectRecords[i % projectRecords.length];
      data = { orgProjectId: p.id, leadId: null, trackingId: null };
      counts.project++;
    } else if (bucket === 2) {
      const l = leadRecords[i % leadRecords.length];
      data = { orgProjectId: null, leadId: l.id, trackingId };
      counts.lead++;
    } else {
      data = { orgProjectId: null, leadId: null, trackingId: null };
      counts.none++;
    }

    await prisma.action.update({ where: { id: a.id }, data });
  }

  console.log(`✓ Vinculações aplicadas:`, counts);
  console.log(`\n✅ Seed completo! Recarregue o /calendário workspace.`);
}

main()
  .catch((e) => {
    console.error("❌ Falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
