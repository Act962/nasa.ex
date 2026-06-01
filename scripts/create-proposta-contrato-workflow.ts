/**
 * Setup do teste de Proposta → Assinatura → Contrato.
 *
 * 1. Cria tags faltantes (Proposta Pendente, Proposta Aceita, Contrato
 *    Assinado, Recusou Proposta) se não existirem
 * 2. Cria um Contract Template básico na org (precisa pra SEND_CONTRACT)
 * 3. Cria workflow novo "Proposta + Contrato — Consultoria NASA"
 *    no tracking AGENDAMENTO, agentMode=true, com:
 *
 *    Trigger LEAD_TAGGED(Consultoria NASA)
 *      ↓ TAG "Proposta Pendente"
 *      ↓ SEND_PROPOSAL (Consultoria NASA, R$ 12.000)
 *      ↓ WAIT_FOR_EVENT (message-incoming, 5min teste / 24h prod)
 *      ↓ AI_DECISION (aceitou/rejeitou/sem_resposta) — com fallback
 *      ├─ aceitou   → TAG "Proposta Aceita" → SEND_CONTRACT → TAG "Contrato Assinado"
 *      ├─ rejeitou  → TAG "Recusou Proposta" → SEND_MESSAGE "Obrigado pelo retorno"
 *      └─ sem_resposta → WAIT 1min → SEND_MESSAGE follow-up → fim
 *
 * Idempotente.
 *
 * USO: pnpm tsx scripts/create-proposta-contrato-workflow.ts
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";
import { createId } from "@paralleldrive/cuid2";

const ORG_ID = "GHqaKGx2iD4Za5tnO8WzKbC8xUVBkPg0";
const TRACKING_ID = "cmpqztlub007vdxxb27ubal43"; // AGENDAMENTO
const RESPONSIBLE_USER_ID = "9ce0d7aa-c18a-49d3-9dec-7fd7526fb185"; // owner
const PRODUCT_CONSULTORIA = "cmoswhchx001hdaxbflfnx0td"; // Consultoria NASA R$ 12.000
const TAG_CONSULTORIA = "cmps6k0lz01f7noxbue3gofss";

const TAGS_TO_CREATE = [
  { slug: "proposta-pendente", name: "Proposta Pendente", color: "#FFA500" },
  { slug: "proposta-aceita", name: "Proposta Aceita", color: "#3DB88B" },
  { slug: "contrato-assinado", name: "Contrato Assinado", color: "#1090E0" },
  { slug: "recusou-proposta", name: "Recusou Proposta", color: "#888888" },
];

const WORKFLOW_ID = "wf_proposta_contrato_consultoria";

async function main() {
  // ─── 1. Tags ─────────────────────────────────────────────────
  console.log("═ TAGS");
  const tagIds: Record<string, string> = {};
  for (const t of TAGS_TO_CREATE) {
    const existing = await prisma.tag.findFirst({
      where: { organizationId: ORG_ID, slug: t.slug },
      select: { id: true },
    });
    if (existing) {
      tagIds[t.slug] = existing.id;
      console.log(`  → ${t.name} já existe (${existing.id})`);
    } else {
      const created = await prisma.tag.create({
        data: {
          organizationId: ORG_ID,
          name: t.name,
          slug: t.slug,
          color: t.color,
        },
        select: { id: true },
      });
      tagIds[t.slug] = created.id;
      console.log(`  ✓ ${t.name} criada (${created.id})`);
    }
  }

  // ─── 2. Contract template ────────────────────────────────────
  console.log();
  console.log("═ CONTRACT TEMPLATE");
  const templateName = "Contrato de Serviços NASA — Padrão";
  const existingTemplate: Array<{ id: string }> = await prisma.$queryRawUnsafe(
    'SELECT id FROM forge_contract_templates WHERE organization_id = $1 AND name = $2 LIMIT 1',
    ORG_ID,
    templateName,
  );
  let templateId: string;
  if (existingTemplate[0]) {
    templateId = existingTemplate[0].id;
    console.log(`  → Template já existe (${templateId})`);
  } else {
    templateId = createId();
    const content = `
      <h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
      <p>Pelo presente instrumento, NASA AGENTS LTDA. e {{cliente_nome}}
      celebram o presente contrato, com as seguintes cláusulas:</p>
      <h2>1. Objeto</h2>
      <p>Prestação de serviços de consultoria de processos.</p>
      <h2>2. Valor</h2>
      <p>R$ {{valor}} ({{valor_extenso}})</p>
      <h2>3. Prazo</h2>
      <p>Vigência de {{data_inicio}} a {{data_fim}}.</p>
      <p>Assinatura digital abaixo.</p>
    `.trim();
    await prisma.$executeRawUnsafe(
      'INSERT INTO forge_contract_templates (id, organization_id, name, content, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
      templateId,
      ORG_ID,
      templateName,
      content,
      RESPONSIBLE_USER_ID,
    );
    console.log(`  ✓ Template criado (${templateId})`);
  }

  // ─── 3. Workflow ─────────────────────────────────────────────
  console.log();
  console.log("═ WORKFLOW");
  const existingWf = await prisma.workflow.findUnique({
    where: { id: WORKFLOW_ID },
    select: { id: true },
  });
  if (existingWf) {
    // Deleta nodes/connections antigos pra reconstruir limpo (idempotente)
    await prisma.connection.deleteMany({ where: { workflowId: WORKFLOW_ID } });
    await prisma.node.deleteMany({ where: { workflowId: WORKFLOW_ID } });
    console.log(`  → Workflow existe, limpando nodes/conns pra recriar`);
  } else {
    await prisma.workflow.create({
      data: {
        id: WORKFLOW_ID,
        tracking: { connect: { id: TRACKING_ID } },
        user: { connect: { id: RESPONSIBLE_USER_ID } },
        name: "Proposta + Contrato — Consultoria NASA",
        description:
          "Quando o lead recebe a tag 'Consultoria NASA' (vinda do menu), envia a proposta de Consultoria → aguarda resposta → IA classifica (com fallback) → se aceitou, envia contrato pra assinatura; se rejeitou, encerra com mensagem; senão, follow-up.",
        isActive: true,
        agentMode: true,
      },
    });
    console.log(`  ✓ Workflow criado: ${WORKFLOW_ID}`);
  }

  // ─── 4. Nodes ────────────────────────────────────────────────
  type NodeIn = {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  };
  const nodes: NodeIn[] = [
    {
      id: "wf-pc-trigger",
      type: "LEAD_TAGGED",
      position: { x: 0, y: 0 },
      data: { action: { tagIds: [TAG_CONSULTORIA], conditions: [] } },
    },
    {
      id: "wf-pc-tag-pendente",
      type: "TAG",
      position: { x: 320, y: 0 },
      data: { action: { type: "ADD", tagsIds: [tagIds["proposta-pendente"]] } },
    },
    {
      id: "wf-pc-send-proposal",
      type: "SEND_PROPOSAL",
      position: { x: 640, y: 0 },
      data: {
        action: {
          productIds: [PRODUCT_CONSULTORIA],
          responsibleId: RESPONSIBLE_USER_ID,
          validityDays: 7,
          messageTemplate:
            "Olá {{nome}}! Segue a proposta {{numero}} no valor de {{valor}}, válida até {{validade}}. Acesse: {{url}}",
        },
      },
    },
    {
      id: "wf-pc-wait-response",
      type: "WAIT_FOR_EVENT",
      position: { x: 960, y: 0 },
      data: { eventName: "message-incoming", timeoutMinutes: 5 }, // 5min pra teste
    },
    {
      id: "wf-pc-decide",
      type: "AI_DECISION",
      position: { x: 1280, y: 0 },
      data: {
        prompt:
          "O lead {{lead.name}} respondeu sobre a proposta de Consultoria NASA. Identifique a intenção: ACEITOU (sim, fechado, vamos, ok, etc), REJEITOU (não, sem orçamento, depois, etc) ou SEM_RESPOSTA (resposta ambígua ou off-topic). Responda APENAS o id do branch.",
        branches: [
          { id: "aceitou", label: "Aceitou", description: "Lead aceitou a proposta" },
          { id: "rejeitou", label: "Rejeitou", description: "Lead recusou a proposta" },
          { id: "sem_resposta", label: "Sem resposta clara", description: "Resposta ambígua" },
        ],
        organizationId: ORG_ID,
      },
    },
    // ─ Branch ACEITOU ─
    {
      id: "wf-pc-tag-aceita",
      type: "TAG",
      position: { x: 1600, y: -180 },
      data: { action: { type: "ADD", tagsIds: [tagIds["proposta-aceita"]] } },
    },
    {
      id: "wf-pc-send-contract",
      type: "SEND_CONTRACT",
      position: { x: 1920, y: -180 },
      data: {
        action: {
          templateContractId: templateId,
          messageTemplate:
            "Show, {{nome}}! Segue o contrato pra assinatura: {{url}}",
        },
      },
    },
    {
      id: "wf-pc-tag-assinado",
      type: "TAG",
      position: { x: 2240, y: -180 },
      data: { action: { type: "ADD", tagsIds: [tagIds["contrato-assinado"]] } },
    },
    // ─ Branch REJEITOU ─
    {
      id: "wf-pc-tag-recusou",
      type: "TAG",
      position: { x: 1600, y: 0 },
      data: { action: { type: "ADD", tagsIds: [tagIds["recusou-proposta"]] } },
    },
    {
      id: "wf-pc-thanks",
      type: "SEND_MESSAGE",
      position: { x: 1920, y: 0 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Tudo bem, {{lead.name}}! Obrigado pelo retorno. Se mudar de ideia, é só chamar aqui.",
          },
        },
      },
    },
    // ─ Branch SEM_RESPOSTA ─
    {
      id: "wf-pc-wait-follow",
      type: "WAIT",
      position: { x: 1600, y: 180 },
      data: { action: { type: "minutes", minutes: 1 } }, // 1min teste = 1d prod
    },
    {
      id: "wf-pc-followup",
      type: "SEND_MESSAGE",
      position: { x: 1920, y: 180 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Oi {{lead.name}}, ainda dá tempo de fechar a proposta. Tem alguma dúvida que posso ajudar?",
          },
        },
      },
    },
  ];

  for (const n of nodes) {
    await prisma.node.create({
      data: {
        id: n.id,
        workflow: { connect: { id: WORKFLOW_ID } },
        name: n.type,
        type: n.type as never,
        position: n.position,
        data: n.data as never,
      },
    });
  }
  console.log(`  ✓ ${nodes.length} nodes criados`);

  // ─── 5. Connections ──────────────────────────────────────────
  const conns: Array<{ from: string; to: string; out?: string }> = [
    { from: "wf-pc-trigger", to: "wf-pc-tag-pendente" },
    { from: "wf-pc-tag-pendente", to: "wf-pc-send-proposal" },
    { from: "wf-pc-send-proposal", to: "wf-pc-wait-response" },
    { from: "wf-pc-wait-response", to: "wf-pc-decide" },
    { from: "wf-pc-decide", to: "wf-pc-tag-aceita", out: "aceitou" },
    { from: "wf-pc-tag-aceita", to: "wf-pc-send-contract" },
    { from: "wf-pc-send-contract", to: "wf-pc-tag-assinado" },
    { from: "wf-pc-decide", to: "wf-pc-tag-recusou", out: "rejeitou" },
    { from: "wf-pc-tag-recusou", to: "wf-pc-thanks" },
    { from: "wf-pc-decide", to: "wf-pc-wait-follow", out: "sem_resposta" },
    { from: "wf-pc-wait-follow", to: "wf-pc-followup" },
  ];
  for (const c of conns) {
    await prisma.connection.create({
      data: {
        id: createId(),
        workflow: { connect: { id: WORKFLOW_ID } },
        fromNode: { connect: { id: c.from } },
        toNode: { connect: { id: c.to } },
        fromOutput: c.out ?? "main",
        toInput: "main",
      },
    });
  }
  console.log(`  ✓ ${conns.length} connections criadas`);

  // ─── 6. Validação ────────────────────────────────────────────
  const { validateWorkflowGraph } = await import(
    "../src/features/workflows/lib/validate-workflow-graph"
  );
  const v = await validateWorkflowGraph(WORKFLOW_ID);
  console.log();
  console.log(`═ Validação: valid=${v.valid} | issues=${v.issues.length}`);
  for (const i of v.issues.slice(0, 5))
    console.log(`  - [${i.severity}] ${i.code} ${i.message.slice(0, 100)}`);
}

main()
  .catch((e) => {
    console.error("✗ Falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
