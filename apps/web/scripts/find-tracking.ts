import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";

async function main() {
  const search = process.argv[2] ?? "";
  const trackings = await prisma.tracking.findMany({
    where: {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { id: { equals: search } },
      ],
    },
    select: {
      id: true,
      name: true,
      organizationId: true,
      organization: { select: { name: true } },
      status: { take: 1, orderBy: { order: "asc" }, select: { id: true, name: true } },
      workflows: {
        where: { agentMode: true },
        select: { id: true, name: true, isActive: true, agentMode: true },
      },
    },
  });

  for (const t of trackings) {
    console.log(`──────────────────────────────────────────`);
    console.log(`Tracking: ${t.name}`);
    console.log(`  id: ${t.id}`);
    console.log(`  org: ${t.organization.name}`);
    console.log(`  statusInicial: ${t.status[0]?.name} (${t.status[0]?.id})`);
    console.log(`  workflows agentMode:`);
    for (const w of t.workflows) {
      console.log(`    - ${w.name} (id=${w.id}, ativo=${w.isActive})`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
