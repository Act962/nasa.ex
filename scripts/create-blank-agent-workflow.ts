/**
 * Cria um workflow VAZIO em Modo Agente IA num tracking — sem nós, sem
 * conexões, só o esqueleto. Operador constrói à mão no canvas.
 *
 * Uso:
 *   pnpm tsx scripts/create-blank-agent-workflow.ts <trackingId> "<nome>"
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) config({ path: envLocal });
config();

import { createId } from "@paralleldrive/cuid2";
import prisma from "../src/lib/prisma";

async function main() {
  const trackingId = process.argv[2];
  const name = process.argv[3] ?? "Agente de Agendamento";

  if (!trackingId) {
    console.error(
      'Uso: pnpm tsx scripts/create-blank-agent-workflow.ts <trackingId> "<nome>"',
    );
    process.exit(1);
  }

  const tracking = await prisma.tracking.findUnique({
    where: { id: trackingId },
    select: { id: true, name: true, organizationId: true },
  });
  if (!tracking) {
    console.error(`Tracking ${trackingId} não encontrado`);
    process.exit(1);
  }

  const workflow = await prisma.workflow.create({
    data: {
      id: createId(),
      name,
      description: "Workflow em branco criado pra construção manual.",
      trackingId,
      agentMode: true,
      maxRunsPerHour: 60,
      isActive: false,
    },
  });

  console.log(`✓ Workflow vazio criado: ${workflow.id}`);
  console.log(`  Nome: ${name}`);
  console.log(`  agentMode: true | isActive: false`);
  console.log("");
  console.log(`Abra: /tracking/${trackingId}/workflows/${workflow.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
