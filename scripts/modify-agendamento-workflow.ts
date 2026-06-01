/**
 * Modifica o workflow "Agente de Agendamento" (id u79dbh3ghv32by1djax7p2g0)
 * pra os testes do menu interativo:
 *
 *   ANTES: 3 triggers → SEND_MESSAGE(augzbew7) → resto do flow
 *
 *   DEPOIS: 3 triggers → TAG(Falta agendar) → SEND_MESSAGE(BUTTONS menu)
 *           → WAIT_FOR_EVENT(message-incoming, 5min)
 *           → AI_DECISION (3 branches: consultoria/gestao/produtos)
 *           → TAG(Consultoria) | TAG(Gestao) | TAG(Produtos)
 *           → todos vão pro SEND_MESSAGE(augzbew7) (entrada do flow original)
 *
 * Compressão de WAIT pra teste:
 *   1d → 1 min, 2d → 2 min, etc. (1 dia = 1 minuto)
 *
 * WAIT_FOR_EVENT timeoutMinutes:
 *   1440 (24h) → 2 (2 min) — humano precisa de tempo pra responder em teste
 *
 * Idempotente: re-rodar não duplica nodes; reconhece os IDs já criados
 * via prefixo "menu-" e atualiza em vez de criar novamente.
 *
 * USO:
 *   pnpm tsx scripts/modify-agendamento-workflow.ts
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";
import { createId } from "@paralleldrive/cuid2";

const WORKFLOW_ID = "u79dbh3ghv32by1djax7p2g0";

// Tag IDs (lookup foi feito separado — hardcoded aqui pra evitar query extra)
const TAGS = {
  faltaAgendar: "cmpr7fj8r0018cgxb5b0ugenm",
  agendado: "cmpr7f7lz0016cgxbp7u3wkb9",
  consultoria: "cmps6k0lz01f7noxbue3gofss",
  gestao: "cmps6l2mc01fbnoxbds0jfdz6",
  produtos: "cmps6lby601fdnoxbsom5utyz",
  desistiu90: "pkmuc4zx8iy9w76cws0bdpg4",
};

// IDs estáveis pra inserção idempotente (prefixo "menu-" pra identificar)
const NEW_NODE_IDS = {
  tagFaltaAgendar: "menu-tag-falta-agendar",
  sendButtons: "menu-send-buttons",
  waitMsg: "menu-wait-event",
  aiDecide: "menu-ai-decide",
  tagConsultoria: "menu-tag-consultoria",
  tagGestao: "menu-tag-gestao",
  tagProdutos: "menu-tag-produtos",
};

// Entrada do flow original (SEND_MESSAGE inicial)
const ORIGINAL_ENTRY_NODE_ID = "augzbew7xjsdefgj9959p7o8";

// IDs dos 3 triggers
const TRIGGER_IDS = [
  "ae95c4w99ddv0y5iv5ttvbj8", // NEW_LEAD
  "kbgui025fm9iolowj0i51axt", // LEAD_TAGGED (Inbound)
  "cmwm5amxy75ud98m6e0ihng2", // MESSAGE_INCOMING
];

// SEND_MESSAGE de sucesso no flow original — quero adicionar TAG "Agendado"
// antes dele OU mudar o TAG d7rc146v (que é "AGENDA") pra usar "Agendado"
const TAG_AGENDA_OLD_NODE_ID = "d7rc146viu0qchea7hvui8ho"; // TAG com tag id cmpn85en (AGENDA)

async function main() {
  const wf = await prisma.workflow.findUnique({
    where: { id: WORKFLOW_ID },
    include: { nodes: true, connections: true },
  });
  if (!wf) throw new Error("Workflow não encontrado");
  console.log(`Workflow: ${wf.name} (${wf.nodes.length} nodes, ${wf.connections.length} connections)`);

  // Operação em transaction — tudo-ou-nada
  await prisma.$transaction(async (tx) => {
    // ─── 1. UPSERT dos 7 novos nodes ─────────────────────────────
    const newNodesData = [
      {
        id: NEW_NODE_IDS.tagFaltaAgendar,
        type: "TAG" as const,
        position: { x: -800, y: 0 },
        data: {
          action: { type: "ADD", tagsIds: [TAGS.faltaAgendar] },
        },
      },
      {
        id: NEW_NODE_IDS.sendButtons,
        type: "SEND_MESSAGE" as const,
        position: { x: -480, y: 0 },
        data: {
          action: {
            payload: {
              type: "BUTTONS",
              mode: "inline",
              bodyText:
                "Olá {{lead.name}}! 👋 Sobre qual serviço da NASA você gostaria de saber mais?",
              footerText: "Escolha uma opção abaixo",
              buttons: [
                {
                  id: "consultoria",
                  text: "Consultoria de processos NASA",
                },
                {
                  id: "gestao",
                  text: "Gestão estratégica digital",
                },
                {
                  id: "produtos",
                  text: "Produtos NASA",
                },
              ],
            },
            target: { sendMode: "LEAD" },
          },
        },
      },
      {
        id: NEW_NODE_IDS.waitMsg,
        type: "WAIT_FOR_EVENT" as const,
        position: { x: -160, y: 0 },
        data: {
          eventName: "message-incoming",
          timeoutMinutes: 5,
        },
      },
      {
        id: NEW_NODE_IDS.aiDecide,
        type: "AI_DECISION" as const,
        position: { x: 160, y: 0 },
        data: {
          prompt:
            "O lead {{lead.name}} acabou de clicar num botão de menu (Consultoria de processos NASA, Gestão estratégica digital ou Produtos NASA). Analise a resposta dele e identifique QUAL botão foi escolhido. Responda APENAS com o id do branch (consultoria, gestao ou produtos).",
          branches: [
            {
              id: "consultoria",
              label: "Consultoria",
              description: "Lead escolheu Consultoria de processos NASA",
            },
            {
              id: "gestao",
              label: "Gestão",
              description: "Lead escolheu Gestão estratégica digital",
            },
            {
              id: "produtos",
              label: "Produtos",
              description: "Lead escolheu Produtos NASA",
            },
          ],
        },
      },
      {
        id: NEW_NODE_IDS.tagConsultoria,
        type: "TAG" as const,
        position: { x: 480, y: -180 },
        data: {
          action: { type: "ADD", tagsIds: [TAGS.consultoria] },
        },
      },
      {
        id: NEW_NODE_IDS.tagGestao,
        type: "TAG" as const,
        position: { x: 480, y: 0 },
        data: {
          action: { type: "ADD", tagsIds: [TAGS.gestao] },
        },
      },
      {
        id: NEW_NODE_IDS.tagProdutos,
        type: "TAG" as const,
        position: { x: 480, y: 180 },
        data: {
          action: { type: "ADD", tagsIds: [TAGS.produtos] },
        },
      },
    ];

    for (const n of newNodesData) {
      await tx.node.upsert({
        where: { id: n.id },
        create: {
          id: n.id,
          workflow: { connect: { id: WORKFLOW_ID } },
          name: n.type,
          type: n.type,
          position: n.position,
          data: n.data,
        },
        update: {
          data: n.data,
          position: n.position,
        },
      });
    }
    console.log(`✓ ${newNodesData.length} nodes do menu inseridos/atualizados`);

    // ─── 2. Remove conexões antigas (triggers → augzbew7) ────────
    const removedConns = await tx.connection.deleteMany({
      where: {
        workflowId: WORKFLOW_ID,
        fromNodeId: { in: TRIGGER_IDS },
        toNodeId: ORIGINAL_ENTRY_NODE_ID,
      },
    });
    console.log(`✓ ${removedConns.count} conexões antigas removidas (triggers → entry)`);

    // Remove qualquer conexão antiga partindo dos novos nodes (pra recriar limpas)
    const newNodeIds = Object.values(NEW_NODE_IDS);
    await tx.connection.deleteMany({
      where: {
        workflowId: WORKFLOW_ID,
        OR: [
          { fromNodeId: { in: newNodeIds } },
          { toNodeId: { in: newNodeIds } },
        ],
      },
    });

    // ─── 3. Cria novas conexões ──────────────────────────────────
    const newConns: Array<{
      fromNodeId: string;
      toNodeId: string;
      fromOutput?: string;
      toInput?: string;
    }> = [
      // Triggers → tagFaltaAgendar
      ...TRIGGER_IDS.map((t) => ({
        fromNodeId: t,
        toNodeId: NEW_NODE_IDS.tagFaltaAgendar,
      })),
      // tagFaltaAgendar → sendButtons
      {
        fromNodeId: NEW_NODE_IDS.tagFaltaAgendar,
        toNodeId: NEW_NODE_IDS.sendButtons,
      },
      // sendButtons → waitMsg
      {
        fromNodeId: NEW_NODE_IDS.sendButtons,
        toNodeId: NEW_NODE_IDS.waitMsg,
      },
      // waitMsg → aiDecide
      {
        fromNodeId: NEW_NODE_IDS.waitMsg,
        toNodeId: NEW_NODE_IDS.aiDecide,
      },
      // aiDecide branches → tags por serviço
      {
        fromNodeId: NEW_NODE_IDS.aiDecide,
        toNodeId: NEW_NODE_IDS.tagConsultoria,
        fromOutput: "consultoria",
      },
      {
        fromNodeId: NEW_NODE_IDS.aiDecide,
        toNodeId: NEW_NODE_IDS.tagGestao,
        fromOutput: "gestao",
      },
      {
        fromNodeId: NEW_NODE_IDS.aiDecide,
        toNodeId: NEW_NODE_IDS.tagProdutos,
        fromOutput: "produtos",
      },
      // Cada TAG de serviço → entry do flow original
      {
        fromNodeId: NEW_NODE_IDS.tagConsultoria,
        toNodeId: ORIGINAL_ENTRY_NODE_ID,
      },
      {
        fromNodeId: NEW_NODE_IDS.tagGestao,
        toNodeId: ORIGINAL_ENTRY_NODE_ID,
      },
      {
        fromNodeId: NEW_NODE_IDS.tagProdutos,
        toNodeId: ORIGINAL_ENTRY_NODE_ID,
      },
    ];

    for (const c of newConns) {
      await tx.connection.create({
        data: {
          id: createId(),
          workflow: { connect: { id: WORKFLOW_ID } },
          fromNode: { connect: { id: c.fromNodeId } },
          toNode: { connect: { id: c.toNodeId } },
          fromOutput: c.fromOutput ?? "main",
          toInput: c.toInput ?? "main",
        },
      });
    }
    console.log(`✓ ${newConns.length} conexões novas criadas`);

    // ─── 4. Comprime WAITs (days → minutes, 1d=1min ratio) ───────
    const waitNodes = await tx.node.findMany({
      where: { workflowId: WORKFLOW_ID, type: "WAIT" },
      select: { id: true, data: true },
    });
    let waitConverted = 0;
    for (const n of waitNodes) {
      const d = n.data as { action?: { type?: string; days?: number; minutes?: number } } | null;
      const action = d?.action;
      if (!action) continue;
      if (action.type === "days" && typeof action.days === "number") {
        await tx.node.update({
          where: { id: n.id },
          data: {
            data: {
              action: {
                type: "minutes",
                minutes: action.days,
              },
            },
          },
        });
        waitConverted++;
        console.log(`  ✓ WAIT ${n.id.slice(0, 8)}: ${action.days}d → ${action.days}min`);
      }
    }
    console.log(`✓ ${waitConverted} WAIT nodes comprimidos`);

    // ─── 5. Comprime WAIT_FOR_EVENT timeouts (1440 → 2 pra testes) ──
    const wfeNodes = await tx.node.findMany({
      where: { workflowId: WORKFLOW_ID, type: "WAIT_FOR_EVENT" },
      select: { id: true, data: true },
    });
    let wfeConverted = 0;
    for (const n of wfeNodes) {
      const d = n.data as { eventName?: string; timeoutMinutes?: number } | null;
      if (!d) continue;
      // 1440 minutos (24h) é o original do flow de follow-up — comprime pra 2min
      // 5 minutos é o WAIT inicial (resposta de menu) — mantém
      if (d.timeoutMinutes === 1440) {
        await tx.node.update({
          where: { id: n.id },
          data: {
            data: {
              eventName: d.eventName,
              timeoutMinutes: 2,
            },
          },
        });
        wfeConverted++;
        console.log(`  ✓ WAIT_FOR_EVENT ${n.id.slice(0, 8)}: 1440min → 2min`);
      }
    }
    console.log(`✓ ${wfeConverted} WAIT_FOR_EVENT nodes comprimidos`);

    // ─── 6. Troca tag "AGENDA" pelo "Agendado" no ramo de sucesso ─
    // O node d7rc146v aplica tag id cmpn85en (AGENDA) quando lead confirma.
    // Adiciona "Agendado" tb.
    await tx.node.update({
      where: { id: TAG_AGENDA_OLD_NODE_ID },
      data: {
        data: {
          action: {
            type: "ADD",
            tagsIds: [TAGS.agendado],
          },
        },
      },
    });
    console.log(`✓ TAG ${TAG_AGENDA_OLD_NODE_ID.slice(0, 8)}: agora aplica "Agendado"`);
  });

  // Validar via validateWorkflowGraph
  const { validateWorkflowGraph } = await import(
    "../src/features/workflows/lib/validate-workflow-graph"
  );
  const validation = await validateWorkflowGraph(WORKFLOW_ID);
  console.log();
  console.log("=== Validação final ===");
  console.log(`Valid: ${validation.valid} | Issues: ${validation.issues.length}`);
  for (const i of validation.issues.slice(0, 10)) {
    console.log(` - [${i.severity}] ${i.code} ${i.nodeId ? "(" + i.nodeId.slice(0, 8) + ")" : ""} ${i.message.slice(0, 90)}`);
  }
}

main()
  .catch((e) => {
    console.error("✗ Falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
