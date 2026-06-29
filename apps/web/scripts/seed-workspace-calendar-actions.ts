/**
 * Seed de ações no calendário do workspace para o usuário logado.
 *
 * Objetivo: popular o "Calendário Workspace" com ações reais distribuídas
 * pelo mês corrente, cobrindo todos os 4 vínculos de pertencimento:
 * (1) criador (2) participante (3) responsável (4) membro do workspace.
 *
 * Uso:
 *   npx tsx scripts/seed-workspace-calendar-actions.ts
 *
 * Pode ser executado várias vezes — cada execução adiciona mais 15 ações
 * (não há upsert por título; o seed é cumulativo). Se quiser limpar, use:
 *   await prisma.action.deleteMany({ where: { title: { startsWith: "[SEED]" } } })
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

function setTime(d: Date, hh: number, mm = 0): Date {
  const x = new Date(d);
  x.setHours(hh, mm, 0, 0);
  return x;
}

async function main() {
  // 1. User
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, name: true },
  });
  if (!user) throw new Error(`Usuário não encontrado: ${USER_EMAIL}`);
  console.log(`✓ User: ${user.name} (${user.id})`);

  // 2. Organização ativa (primeira Member)
  const member = await prisma.member.findFirst({
    where: { userId: user.id },
    select: {
      organizationId: true,
      organization: { select: { id: true, name: true } },
    },
  });
  if (!member) throw new Error("Usuário sem organização");
  console.log(`✓ Org: ${member.organization.name} (${member.organizationId})`);

  // 3. Workspaces da org (não arquivados) — pega até 3
  const workspaces = await prisma.workspace.findMany({
    where: { organizationId: member.organizationId, isArchived: false },
    take: 3,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      columns: { take: 1, orderBy: { order: "asc" }, select: { id: true } },
    },
  });

  if (workspaces.length === 0) {
    throw new Error(
      `Nenhum workspace ativo na org ${member.organization.name}. Crie um workspace antes.`,
    );
  }
  console.log(`✓ Workspaces: ${workspaces.map((w) => w.name).join(", ")}`);

  // 4. Garante que o user é membro de pelo menos 1 workspace (vínculo #4)
  const firstWs = workspaces[0];
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: firstWs.id, userId: user.id } },
    create: { workspaceId: firstWs.id, userId: user.id, role: "MEMBER" },
    update: {},
  });
  console.log(`✓ User confirmado como membro de "${firstWs.name}"`);

  // 5. Distribui 15 ações pelos -7..+22 dias a partir de hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const offsets = [-7, -5, -3, -1, 0, 0, 1, 2, 4, 7, 10, 13, 16, 20, 22];
  const titles = [
    "[SEED] Daily standup",
    "[SEED] Reunião com cliente — Acme",
    "[SEED] Sprint planning",
    "[SEED] Revisão de código — Auth",
    "[SEED] Demo de produto",
    "[SEED] 1:1 com líder",
    "[SEED] Workshop de descoberta",
    "[SEED] Entrega da proposta",
    "[SEED] Follow-up Linnker",
    "[SEED] Treinamento NASA Forge",
    "[SEED] Calibração de processo",
    "[SEED] Apresentação executiva",
    "[SEED] Retro mensal",
    "[SEED] Onboarding novo membro",
    "[SEED] Planejamento Q2",
  ];
  // CDN público — habilitado em next.config.ts
  const covers = [
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=75",
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=75",
    "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&q=75",
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&q=75",
    "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&q=75",
    "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&q=75",
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&q=75",
    "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&q=75",
    "https://images.unsplash.com/photo-1531497865144-0464ef8fb9a9?w=400&q=75",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=75",
    "https://images.unsplash.com/photo-1581090700227-1e37b190418e?w=400&q=75",
    "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=400&q=75",
    "https://images.unsplash.com/photo-1558403194-611308249627?w=400&q=75",
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=75",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=75",
  ];
  const priorities = ["NONE", "LOW", "MEDIUM", "HIGH"] as const;

  let created = 0;

  for (let i = 0; i < titles.length; i++) {
    const offsetDay = offsets[i];
    const baseDay = new Date(today);
    baseDay.setDate(baseDay.getDate() + offsetDay);

    const hour = 8 + (i % 10); // 8h..17h
    const startDate = setTime(baseDay, hour, 0);
    const dueDate = setTime(baseDay, hour + 1, 0);

    const ws = workspaces[i % workspaces.length];
    const isDone = i % 5 === 0;

    // Determina o vínculo de pertencimento
    const role = ["creator", "participant", "responsible", "ws-member"][i % 4];

    // Para "creator", o user é o createdBy. Para outros, escolhemos um
    // co-membro qualquer da org como criador (cai em "outro user").
    let creatorId = user.id;
    if (role !== "creator" && role !== "ws-member") {
      const otherMember = await prisma.member.findFirst({
        where: {
          organizationId: member.organizationId,
          userId: { not: user.id },
        },
        select: { userId: true },
      });
      creatorId = otherMember?.userId ?? user.id; // fallback: user mesmo
    }

    // Para vínculo "ws-member" o user só está ligado pelo workspace
    if (role === "ws-member") {
      const otherMember = await prisma.member.findFirst({
        where: {
          organizationId: member.organizationId,
          userId: { not: user.id },
        },
        select: { userId: true },
      });
      creatorId = otherMember?.userId ?? user.id;
    }

    const action = await prisma.action.create({
      data: {
        title: titles[i],
        description: `Ação criada via seed (vínculo: ${role}, offset ${offsetDay}d)`,
        priority: priorities[i % priorities.length],
        isDone,
        startDate,
        dueDate,
        endDate: setTime(baseDay, hour + 1, 30),
        coverImage: covers[i % covers.length],
        workspaceId: ws.id,
        columnId: ws.columns[0]?.id ?? null,
        organizationId: member.organizationId,
        createdBy: creatorId,
        ...(role === "participant" && {
          participants: { create: { userId: user.id } },
        }),
        ...(role === "responsible" && {
          responsibles: { create: { userId: user.id } },
        }),
      },
      select: { id: true, title: true, dueDate: true },
    });

    created++;
    console.log(
      `  [${role.padEnd(11)}] ${action.title}  ${action.dueDate?.toISOString().slice(0, 16)}  → ${ws.name}`,
    );
  }

  console.log(`\n✅ ${created} ações criadas no mês de ${today.toISOString().slice(0, 7)}`);
  console.log(
    `   Recarregue /workspaces e abra "Calendário Workspace" para ver.`,
  );
}

main()
  .catch((e) => {
    console.error("ERRO:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
