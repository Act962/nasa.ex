import { config } from "dotenv";
import { existsSync } from "node:fs";
const e = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(e)) config({ path: e });
config();

import prisma from "../src/lib/prisma";

async function main() {
  const runId = process.argv[2];
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { nodeRuns: { orderBy: { startedAt: "asc" } } },
  });
  if (!run) return console.log("not found");
  console.log("Run:", run.id, "status:", run.status);
  for (const n of run.nodeRuns) {
    console.log("\n──", n.nodeType, "→", n.chosenOutput, n.status, n.errorMessage ?? "");
    console.log("  output:", JSON.stringify(n.output).slice(0, 500));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
