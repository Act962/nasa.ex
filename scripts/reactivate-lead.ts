import { config } from "dotenv";
import { existsSync } from "node:fs";
const e = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(e)) config({ path: e });
config();
import prisma from "../src/lib/prisma";
async function main() {
  const leadId = process.argv[2];
  if (!leadId) {
    console.error("Uso: pnpm tsx scripts/reactivate-lead.ts <leadId>");
    process.exit(1);
  }
  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      isActive: true,
      isArchived: false,
      archivedAt: null,
      statusFlow: "ACTIVE",
    },
    select: { id: true, name: true, phone: true, isActive: true, statusFlow: true },
  });
  console.log("✓", updated);
}
main().catch(console.error).finally(() => prisma.$disconnect());
