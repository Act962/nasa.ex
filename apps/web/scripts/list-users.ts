import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
} as any);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // 1. Sessões ativas (mais recentes) — descobre quem está logado agora
  const sessions = await prisma.session.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      userId: true,
      activeOrganizationId: true,
      updatedAt: true,
      expiresAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  console.log("=== Sessões mais recentes ===");
  console.table(
    sessions.map((s) => ({
      email: s.user.email,
      name: s.user.name,
      activeOrgId: s.activeOrganizationId?.slice(0, 12),
      updated: s.updatedAt.toISOString().slice(0, 16),
      expires: s.expiresAt.toISOString().slice(0, 10),
    })),
  );

  // 2. Workspaces com mais ações — sinaliza orgs ativas
  const wsCounts = await prisma.workspace.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      name: true,
      organization: { select: { id: true, name: true } },
      _count: { select: { actions: true, members: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  console.log("\n=== Workspaces ativos ===");
  console.table(
    wsCounts.map((w) => ({
      wsId: w.id.slice(0, 10),
      ws: w.name,
      org: w.organization.name,
      actions: w._count.actions,
      members: w._count.members,
    })),
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());
