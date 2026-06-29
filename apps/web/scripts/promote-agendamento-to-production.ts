/**
 * Promove o workflow "Agente de Agendamento" testado em sessão pra
 * estado de produção:
 *   1. Renomeia pra nome descritivo
 *   2. Reverte tempos comprimidos (1min → 1d, 2min → 2d, etc.)
 *   3. Atualiza WAIT_FOR_EVENT timeouts (2min → 1440min = 24h)
 *
 * Mantém a estrutura testada (menu + AI_DECISION com fallback embutido
 * via executor). Idempotente: rodar 2x não duplica nada.
 *
 * USO: pnpm tsx scripts/promote-agendamento-to-production.ts
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";

const WORKFLOW_ID = "u79dbh3ghv32by1djax7p2g0";

// Mapa de IDs dos WAIT pra confirmar reversão dos tempos comprimidos
// (são os 5 que comprimimos no script anterior modify-agendamento-workflow)
const WAIT_NODES_PROD_VALUES = [
  { id: "l47beqwdm2id97zqwyp06a6t", days: 1 },
  { id: "ehxt2369bt2e22fo8h0sduv7", days: 1 },
  { id: "tfj7wdjihdk01z4kp7bihe0l", days: 1 },
  { id: "qzff48nxergsth87syg8m1qq", days: 2 },
  { id: "z9vj33l6a05sdtvz88p8j9zr", days: 2 },
];

async function main() {
  const wf = await prisma.workflow.findUnique({
    where: { id: WORKFLOW_ID },
    select: { name: true },
  });
  if (!wf) throw new Error("Workflow não encontrado");
  console.log(`Workflow atual: "${wf.name}"`);

  await prisma.$transaction(async (tx) => {
    // ─── 1. Renomeia ─────────────────────────────────────────────
    const newName =
      "Atendimento Comercial — Menu Interativo + Agendamento + Follow-up";
    await tx.workflow.update({
      where: { id: WORKFLOW_ID },
      data: {
        name: newName,
        description:
          "Quando o lead entra (via NEW_LEAD, tag Inbound ou primeira mensagem), envia menu de 3 botões → IA classifica a escolha (com fallback heurístico se OpenAI cair) → aplica tag por serviço → envia link de agenda → cadência de follow-up 1/1/1/2/2 dias → tag final 'Desistiu 90' se nenhuma resposta.",
      },
    });
    console.log(`✓ Renomeado pra "${newName}"`);

    // ─── 2. Reverte WAITs (minutos → dias) ──────────────────────
    for (const w of WAIT_NODES_PROD_VALUES) {
      const node = await tx.node.findUnique({
        where: { id: w.id },
        select: { data: true },
      });
      if (!node) {
        console.log(`  ⚠ WAIT ${w.id.slice(0, 8)} não existe — pulando`);
        continue;
      }
      await tx.node.update({
        where: { id: w.id },
        data: {
          data: {
            action: { type: "days", days: w.days },
          },
        },
      });
      console.log(`  ✓ WAIT ${w.id.slice(0, 8)}: → ${w.days} dia(s)`);
    }

    // ─── 3. Reverte WAIT_FOR_EVENT (2min → 1440min = 24h) ──────
    // Exceto o WAIT_FOR_EVENT inicial do menu (5min — mantém igual,
    // 5 min de espera por resposta a menu de botões é razoável em prod)
    const wfeNodes = await tx.node.findMany({
      where: { workflowId: WORKFLOW_ID, type: "WAIT_FOR_EVENT" },
      select: { id: true, data: true },
    });
    let reverted = 0;
    for (const n of wfeNodes) {
      const d = n.data as { eventName?: string; timeoutMinutes?: number } | null;
      if (!d) continue;
      // Pula o inicial (timeout 5min — mantém em produção)
      if (d.timeoutMinutes === 5) {
        console.log(`  → WAIT_FOR_EVENT ${n.id.slice(0, 8)}: mantém 5min (menu inicial)`);
        continue;
      }
      // Reverte os comprimidos (2min) pra 1440min (24h)
      if (d.timeoutMinutes === 2) {
        await tx.node.update({
          where: { id: n.id },
          data: { data: { eventName: d.eventName, timeoutMinutes: 1440 } },
        });
        console.log(`  ✓ WAIT_FOR_EVENT ${n.id.slice(0, 8)}: 2min → 1440min (24h)`);
        reverted++;
      }
    }
    console.log(`✓ ${reverted} WAIT_FOR_EVENT revertidos pra 24h`);
  });

  console.log();
  console.log("═ Status final ═");
  const final = await prisma.workflow.findUnique({
    where: { id: WORKFLOW_ID },
    select: { name: true, description: true, isActive: true, agentMode: true },
  });
  console.log(`Nome: ${final?.name}`);
  console.log(`Descrição: ${final?.description}`);
  console.log(`isActive: ${final?.isActive} | agentMode: ${final?.agentMode}`);
}

main()
  .catch((e) => {
    console.error("✗ Falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
