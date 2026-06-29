import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "");
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
} as any);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const ORG = process.env.SEED_ORG_NAME ?? "GOTHAN CITY";
  const org = await prisma.organization.findFirst({
    where: { name: ORG },
    select: { id: true, name: true },
  });
  if (!org) {
    console.log(`❌ Org "${ORG}" não existe`);
    return;
  }
  console.log(`🏢 ${org.name} (${org.id})\n`);

  const total = await prisma.action.count({
    where: { organizationId: org.id, isArchived: false },
  });
  const done = await prisma.action.count({
    where: { organizationId: org.id, isArchived: false, isDone: true },
  });
  const open = await prisma.action.count({
    where: { organizationId: org.id, isArchived: false, isDone: false },
  });
  const overdue = await prisma.action.count({
    where: {
      organizationId: org.id,
      isArchived: false,
      isDone: false,
      dueDate: { lt: new Date() },
    },
  });
  console.log(`Sem filtro de data:`);
  console.log(`  total: ${total}, done: ${done}, open: ${open}, overdue: ${overdue}\n`);

  const recent = await prisma.action.findMany({
    where: { organizationId: org.id, isArchived: false },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, createdAt: true, type: true, isDone: true },
  });
  console.log(`Últimas 5 ações criadas:`);
  for (const a of recent) {
    console.log(
      `  ${a.createdAt.toISOString().slice(0, 10)} · type=${a.type} · isDone=${a.isDone} · ${a.title.slice(0, 50)}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
