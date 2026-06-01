import { config } from "dotenv";
import { existsSync } from "node:fs";
const e = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(e)) config({ path: e });
config();

import prisma from "../src/lib/prisma";

async function main() {
  const workflowId = process.argv[2];
  if (!workflowId) {
    console.error("Uso: pnpm tsx scripts/activate-workflow.ts <workflowId>");
    process.exit(1);
  }
  const updated = await prisma.workflow.update({
    where: { id: workflowId },
    data: { isActive: true },
    select: { id: true, name: true, isActive: true },
  });
  console.log("✓", updated);
}
main().catch(console.error).finally(() => prisma.$disconnect());
