import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const u = await prisma.user.findUnique({
    where: { email: "coringaforevernasa@gmail.com" },
    include: {
      members: { include: { organization: { select: { id: true, name: true } } } },
    },
  });
  if (!u) {
    console.log("❌ user not found");
    return;
  }
  console.log("user:", u.id, u.email);
  for (const m of u.members) {
    console.log(`  org: ${m.organization.name} (${m.organization.id}) role=${m.role}`);
    const ws = await prisma.workspace.findMany({
      where: {
        organizationId: m.organization.id,
        members: { some: { userId: u.id } },
      },
      select: { id: true, name: true },
      take: 10,
    });
    console.log("    workspaces:", ws.length);
    for (const w of ws) console.log(`      - ${w.name} (${w.id})`);
  }
}

main().finally(() => prisma.$disconnect());
