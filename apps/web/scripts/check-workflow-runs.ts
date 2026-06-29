import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";

async function main() {
  const workflowId = process.argv[2];
  if (!workflowId) {
    console.error("Uso: pnpm tsx scripts/check-workflow-runs.ts <workflowId>");
    process.exit(1);
  }

  const runs = await prisma.workflowRun.findMany({
    where: { workflowId },
    orderBy: { startedAt: "desc" },
    take: 5,
    include: {
      nodeRuns: {
        orderBy: { startedAt: "asc" },
        select: {
          nodeType: true,
          chosenOutput: true,
          status: true,
          errorMessage: true,
          startedAt: true,
          finishedAt: true,
        },
      },
    },
  });

  for (const r of runs) {
    console.log("──────────────────────────────────────────");
    console.log(`Run id:        ${r.id}`);
    console.log(`status:        ${r.status}`);
    console.log(`leadId:        ${r.leadId}`);
    console.log(`trigger:       ${r.triggerType}`);
    console.log(`nodesExecuted: ${r.nodesExecuted}`);
    console.log(`starsSpent:    ${r.starsSpent}`);
    const fmtBRT = (d: Date) =>
      d.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour12: false,
      });
    console.log(`startedAt:     ${fmtBRT(r.startedAt)} BRT`);
    console.log(
      `finishedAt:    ${r.finishedAt ? fmtBRT(r.finishedAt) + " BRT" : "(em andamento)"}`,
    );
    if (r.errorMessage) console.log(`error:         ${r.errorMessage}`);
    console.log(`Nodes (${r.nodeRuns.length}):`);
    for (const n of r.nodeRuns) {
      console.log(`  - ${n.nodeType} → ${n.chosenOutput} [${n.status}] ${n.errorMessage ?? ""}`);
    }
  }
  console.log("──────────────────────────────────────────");
}
main().catch(console.error).finally(() => prisma.$disconnect());
