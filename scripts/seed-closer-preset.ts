/**
 * Aplica o preset "Closer Comercial — Opção X com Follow-up" num tracking.
 *
 * Uso:
 *   pnpm tsx scripts/seed-closer-preset.ts <trackingId>
 *
 * O script cria o workflow com `agentMode=true` e `isActive=false` (segurança).
 * Os placeholders (PRODUTO_X_ID, TAGs, MOVE_LEAD destino) ficam visíveis no
 * canvas pra você editar antes de ativar.
 *
 * Estratégia: descobre a org pelo tracking, aplica via `seedCloserComFollowup`,
 * imprime a URL final pra abrir no editor.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// `.env.local` tem prioridade sobre `.env` (mesmo padrão do Next).
const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) config({ path: envLocal });
config(); // fallback pro .env padrão

import prisma from "../src/lib/prisma";
import { seedCloserComFollowup } from "../src/features/workflows/lib/agent-presets/closer-com-followup";

async function main() {
  const trackingId = process.argv[2];
  if (!trackingId) {
    console.error("Uso: pnpm tsx scripts/seed-closer-preset.ts <trackingId>");
    process.exit(1);
  }

  const tracking = await prisma.tracking.findUnique({
    where: { id: trackingId },
    select: { id: true, name: true, organizationId: true },
  });

  if (!tracking) {
    console.error(`Tracking ${trackingId} não encontrado.`);
    process.exit(1);
  }

  console.log(
    `Aplicando preset em tracking "${tracking.name}" (org ${tracking.organizationId})...`,
  );

  const result = await seedCloserComFollowup(prisma, {
    organizationId: tracking.organizationId,
    trackingId: tracking.id,
  });

  console.log("");
  console.log("✓ Preset aplicado!");
  console.log(`  workflowId : ${result.workflowId}`);
  console.log(`  nodes      : ${result.nodeCount}`);
  console.log(`  edges      : ${result.edgeCount}`);
  console.log("");
  console.log("Próximos passos:");
  console.log(`  1. Abra: /tracking/${trackingId}/workflows/${result.workflowId}`);
  console.log("  2. Substitua os placeholders nos nós:");
  console.log("     - TAG (Opção X)        → escolher tag real");
  console.log("     - SEND_PROPOSAL        → escolher Produto X + responsável");
  console.log("     - TAG (Aprovado)       → escolher tag real");
  console.log("     - MOVE_LEAD            → escolher Tracking Y + status");
  console.log("  3. Ative o workflow no toggle 'Ativo'.");
  console.log("");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
