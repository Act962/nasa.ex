/**
 * Setup do workflow "Boas-vindas NASA Route".
 *
 * Estrutura:
 *
 *   PAYMENT_RECEIVED (trigger — disparado por purchase-crm-side-effects
 *                     do NASA Route após criar enrollment + lead)
 *     → TAG "Aluno NASA Route"
 *     → SEND_EMAIL welcome-course (React Email caprichado)
 *     → WAIT 1min (espaçamento entre canais)
 *     → SEND_MESSAGE WhatsApp boas-vindas + link do curso
 *     → WAIT 3d (em prod / 1min em TEST_MODE)
 *     → SEND_MESSAGE check-in "como tá indo?"
 *
 * Triggers PAYMENT_RECEIVED disparam pra TODOS os workflows com esse nó
 * na org/tracking certo. Pra este workflow rodar, o curso precisa ter
 * `purchaseTrackingId` configurado + o tracking precisa estar selecionado
 * neste script (TRACKING_ID).
 *
 * Idempotente: re-rodar limpa nodes/conns e recria.
 *
 * USO:
 *   pnpm tsx scripts/create-boas-vindas-nasa-route.ts
 *   TEST_MODE=false pnpm tsx scripts/create-boas-vindas-nasa-route.ts (prod)
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";
import { createId } from "@paralleldrive/cuid2";

const ORG_ID = "GHqaKGx2iD4Za5tnO8WzKbC8xUVBkPg0";
const TRACKING_ID = "cmpqztlub007vdxxb27ubal43";
const RESPONSIBLE_USER_ID = "9ce0d7aa-c18a-49d3-9dec-7fd7526fb185";
const WORKFLOW_ID = "wf_boas_vindas_nasa_route";

const TEST_MODE = process.env.TEST_MODE !== "false";
const T = (testMin: number, prodMin: number) =>
  TEST_MODE ? testMin : prodMin;

const TAGS_TO_CREATE = [
  { slug: "aluno-nasa-route", name: "Aluno NASA Route", color: "#7c3aed" },
];

async function ensureTags(): Promise<Record<string, string>> {
  console.log("═ TAGS");
  const tagIds: Record<string, string> = {};
  for (const t of TAGS_TO_CREATE) {
    const existing = await prisma.tag.findFirst({
      where: { organizationId: ORG_ID, slug: t.slug },
      select: { id: true },
    });
    if (existing) {
      tagIds[t.slug] = existing.id;
      console.log(`  → ${t.name} ok (${existing.id})`);
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
  return tagIds;
}

async function main() {
  console.log(
    TEST_MODE
      ? "▸ TEST_MODE=true (WAIT 1min entre etapas pra teste)"
      : "▸ TEST_MODE=false (1min entre email/whatsapp + 3d follow-up)",
  );
  console.log();

  const tagIds = await ensureTags();

  console.log();
  console.log("═ WORKFLOW: Boas-vindas NASA Route");
  const existing = await prisma.workflow.findUnique({
    where: { id: WORKFLOW_ID },
    select: { id: true },
  });
  if (existing) {
    await prisma.connection.deleteMany({ where: { workflowId: WORKFLOW_ID } });
    await prisma.node.deleteMany({ where: { workflowId: WORKFLOW_ID } });
    await prisma.workflow.update({
      where: { id: WORKFLOW_ID },
      data: {
        name: "Boas-vindas NASA Route — Pós-pagamento",
        description:
          "Quando o lead paga um curso NASA Route, dispara: email caprichado de boas-vindas, mensagem WhatsApp com link do curso, follow-up 3 dias depois. Reage ao evento PAYMENT_RECEIVED com leadId/trackingId vindos do purchase-side-effects (que cria o Lead destino com tags).",
        isActive: true,
        agentMode: true,
      },
    });
    console.log(`  → atualizado ${WORKFLOW_ID}`);
  } else {
    await prisma.workflow.create({
      data: {
        id: WORKFLOW_ID,
        tracking: { connect: { id: TRACKING_ID } },
        user: { connect: { id: RESPONSIBLE_USER_ID } },
        name: "Boas-vindas NASA Route — Pós-pagamento",
        description:
          "Quando o lead paga um curso NASA Route, dispara: email caprichado de boas-vindas, mensagem WhatsApp com link do curso, follow-up 3 dias depois.",
        isActive: true,
        agentMode: true,
      },
    });
    console.log(`  ✓ criado ${WORKFLOW_ID}`);
  }

  type NodeIn = {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  };

  const nodes: NodeIn[] = [
    {
      id: "wfbv-trigger",
      type: "PAYMENT_RECEIVED",
      position: { x: 0, y: 0 },
      data: {
        // Sem filtros — workflow reage a qualquer PAYMENT_RECEIVED do
        // tracking. O purchase-side-effects do NASA Route só emite esse
        // evento quando curso é comprado, então não tem ruído de outras
        // origens (proposta, stars genéricos etc).
        action: { conditions: [] },
      },
    },
    {
      id: "wfbv-tag-aluno",
      type: "TAG",
      position: { x: 320, y: 0 },
      data: {
        action: { type: "ADD", tagsIds: [tagIds["aluno-nasa-route"]] },
      },
    },
    {
      id: "wfbv-send-email",
      type: "SEND_EMAIL",
      position: { x: 640, y: 0 },
      data: {
        action: {
          template: "welcome-course",
          // O destinatário cai pra context.lead.email se não passar toEmail.
          // Subject + props vêm do triggerPayload via {{trigger.X}}.
          subject:
            "Bem-vindo(a) ao NASA Route — acesso ao curso liberado 🚀",
          templateProps: {
            // Interpolation rasa: o executor faz interpolate(context, str)
            // em campos string. Os templates aceitam string nesses campos.
            studentName: "{{trigger.studentName}}",
            courseTitle: "{{trigger.courseTitle}}",
            planName: "{{trigger.planName}}",
            creatorName: "NASA Agents",
            coursePlayerUrl: "{{trigger.coursePlayerUrl}}",
          },
        },
      },
    },
    {
      id: "wfbv-wait-1min",
      type: "WAIT",
      position: { x: 960, y: 0 },
      data: { action: { type: "minutes", minutes: 1 } },
    },
    {
      id: "wfbv-send-whatsapp",
      type: "SEND_MESSAGE",
      position: { x: 1280, y: 0 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Show, {{lead.name}}! 🚀 Acabei de confirmar seu acesso ao curso *{{trigger.courseTitle}}* ({{trigger.planName}}).\n\nVocê também recebeu um email com o link. Pra acessar direto, é só clicar: {{trigger.coursePlayerUrl}}\n\nQualquer dúvida, é só responder por aqui que eu te ajudo. Bom estudo!",
          },
        },
      },
    },
    {
      id: "wfbv-wait-3d",
      type: "WAIT",
      position: { x: 1600, y: 0 },
      data: {
        action: TEST_MODE
          ? { type: "minutes", minutes: 1 }
          : { type: "days", days: 3 },
      },
    },
    {
      id: "wfbv-checkin",
      type: "SEND_MESSAGE",
      position: { x: 1920, y: 0 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Oi {{lead.name}}, tudo certo com o curso? Já assistiu alguma aula? Se tiver alguma dúvida ou quiser sugestão de por onde começar, é só me chamar. 👋",
          },
        },
      },
    },
  ];

  for (const nd of nodes) {
    await prisma.node.create({
      data: {
        id: nd.id,
        workflow: { connect: { id: WORKFLOW_ID } },
        name: nd.type,
        type: nd.type as never,
        position: nd.position,
        data: nd.data,
      },
    });
  }

  const conns: Array<{ from: string; to: string }> = [
    { from: "wfbv-trigger", to: "wfbv-tag-aluno" },
    { from: "wfbv-tag-aluno", to: "wfbv-send-email" },
    { from: "wfbv-send-email", to: "wfbv-wait-1min" },
    { from: "wfbv-wait-1min", to: "wfbv-send-whatsapp" },
    { from: "wfbv-send-whatsapp", to: "wfbv-wait-3d" },
    { from: "wfbv-wait-3d", to: "wfbv-checkin" },
  ];

  for (const c of conns) {
    await prisma.connection.create({
      data: {
        id: createId(),
        workflow: { connect: { id: WORKFLOW_ID } },
        fromNode: { connect: { id: c.from } },
        toNode: { connect: { id: c.to } },
        fromOutput: "main",
        toInput: "main",
      },
    });
  }

  console.log(`  ✓ ${nodes.length} nodes + ${conns.length} conns`);

  const { validateWorkflowGraph } = await import(
    "../src/features/workflows/lib/validate-workflow-graph"
  );
  const v = await validateWorkflowGraph(WORKFLOW_ID);
  console.log(`  ─ valid=${v.valid} issues=${v.issues.length}`);
  for (const i of v.issues.slice(0, 5))
    console.log(`     [${i.severity}] ${i.code} ${i.message.slice(0, 90)}`);

  console.log();
  console.log("═══════════════════════════════════════");
  console.log("✓ Workflow criado/atualizado");
  console.log("═══════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("✗ Falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
