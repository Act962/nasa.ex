/**
 * Setup dos 3 workflows Proposta → Cadência → Assinatura → Contrato.
 *
 * Estrutura completa de cada workflow:
 *
 *   LEAD_TAGGED(tag-gatilho)
 *     → TAG "Proposta Pendente"
 *     → SEND_PROPOSAL
 *     → WAIT_FOR_EVENT(5 eventos race, 3d)   ← rodada 1 / D+0..D+3
 *     → AI_DECISION_1
 *         ├ aceitou → [BLOCO CONTRATO]
 *         ├ rejeitou → TAG Recusou → SEND_MESSAGE thanks
 *         └ sem_resposta:
 *             → SEND_MESSAGE "Deu pra ver?" (D+3)
 *             → WAIT_FOR_EVENT(4d)  ← rodada 2 / D+3..D+7
 *             → AI_DECISION_2 (mesmas 3 branches; aceitou/rejeitou reutilizam destino)
 *                 └ sem_resposta:
 *                     → SEND_MESSAGE "Alguma dúvida?" (D+7)
 *                     → WAIT_FOR_EVENT(8d)  ← rodada 3 / D+7..D+15
 *                     → AI_DECISION_3
 *                         └ sem_resposta:
 *                             → SEND_MESSAGE "Última chamada" (D+15)
 *                             → WAIT_FOR_EVENT(15d)  ← rodada 4 / D+15..D+30
 *                             → AI_DECISION_4
 *                                 └ sem_resposta:
 *                                     → TAG "Sem interesse"
 *                                     → SEND_MESSAGE handover humano
 *
 *   [BLOCO CONTRATO] (compartilhado por todas as branches aceitou):
 *     → TAG "Proposta Aceita"
 *     → SEND_CONTRACT  (cria ForgeContract com nome do lead como signer)
 *     → WAIT_FOR_EVENT([contract-signed, message-incoming, lead-tagged], 3d)
 *     → AI_DECISION_C1 (branches: assinou/nao_assinou; default nao_assinou)
 *         ├ assinou → TAG "Contrato Assinado" → SEND_MESSAGE boas-vindas
 *         └ nao_assinou:
 *             → SEND_MESSAGE "Falta assinar — link aqui" (D+3 após aceite)
 *             → WAIT_FOR_EVENT(4d)
 *             → AI_DECISION_C2
 *                 ├ assinou → TAG Assinado
 *                 └ nao_assinou:
 *                     → SEND_MESSAGE "Vou ter que anular em 24h" (D+7)
 *                     → WAIT_FOR_EVENT(7d)
 *                     → AI_DECISION_C3
 *                         ├ assinou → TAG Assinado
 *                         └ nao_assinou → TAG "Sem interesse"
 *
 * TEMPOS:
 *   - TEST_MODE=true  → 1 minuto por wait (pra teste em sessão)
 *   - TEST_MODE=false → 3d/4d/8d/15d (proposta) + 3d/4d/7d (contrato) em produção
 *
 * Idempotente: re-rodar limpa nodes/conns e recria.
 *
 * USO: pnpm tsx scripts/create-proposta-contrato-all.ts
 *   ou: TEST_MODE=false pnpm tsx scripts/create-proposta-contrato-all.ts (prod)
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
const TEMPLATE_NAME = "Contrato de Serviços NASA — Padrão";

const TEST_MODE = process.env.TEST_MODE !== "false"; // default true (testes)
const T = (testMin: number, prodMin: number) =>
  TEST_MODE ? testMin : prodMin;

// Eventos que TODOS os WAIT_FOR_EVENT da proposta escutam em race.
// Qualquer um desbloqueia: lead clica no Forge, lead manda mensagem, user
// aplica tag ou move status — tudo equivale.
const WAIT_EVENTS_PROPOSTA = [
  "proposal-accepted",
  "proposal-rejected",
  "message-incoming",
  "lead-tagged",
  "lead-status-changed",
];

// Pro bloco contrato, foco em assinatura — mas também aceita texto/tag
// pra caso o lead avise por outro canal ou um humano marque manualmente.
const WAIT_EVENTS_CONTRATO = [
  "contract-signed",
  "message-incoming",
  "lead-tagged",
];

const TAGS_TO_CREATE = [
  { slug: "proposta-pendente", name: "Proposta Pendente", color: "#FFA500" },
  { slug: "proposta-aceita", name: "Proposta Aceita", color: "#3DB88B" },
  { slug: "contrato-assinado", name: "Contrato Assinado", color: "#1090E0" },
  { slug: "recusou-proposta", name: "Recusou Proposta", color: "#888888" },
  { slug: "sem-interesse", name: "Sem interesse", color: "#6B7280" },
];

interface WorkflowSpec {
  id: string;
  name: string;
  description: string;
  triggerTagId: string;
  triggerTagName: string;
  productIds: string[];
  proposalSummary: string;
}

const WORKFLOWS: WorkflowSpec[] = [
  {
    id: "wf_proposta_contrato_consultoria",
    name: "Proposta + Contrato — Consultoria NASA",
    description:
      "Tag 'Consultoria NASA' → proposta → cadência longa (D+0/3/7/15/30) → IA classifica resposta (com fallback heurístico + event-match) → se aceita, manda contrato com 3 toques de assinatura. Race entre 5 eventos (Forge/texto/tag/status) — qualquer um desbloqueia.",
    triggerTagId: "cmps6k0lz01f7noxbue3gofss",
    triggerTagName: "Consultoria NASA",
    productIds: ["cmoswhchx001hdaxbflfnx0td"],
    proposalSummary: "Consultoria NASA",
  },
  {
    id: "wf_proposta_contrato_gestao",
    name: "Proposta + Contrato — Gestão Estratégica",
    description:
      "Tag 'Gestão estratégica' → proposta combo (Gestão Digital + Constellation) → mesma cadência longa + 3 toques contrato.",
    triggerTagId: "cmps6l2mc01fbnoxbds0jfdz6",
    triggerTagName: "Gestão estratégica",
    productIds: [
      "cmoswhci7001idaxbjitdj8tm",
      "cmoswhcia001jdaxbrrbyur1p",
    ],
    proposalSummary: "Gestão Estratégica + Constellation",
  },
  {
    id: "wf_proposta_contrato_produtos",
    name: "Proposta + Contrato — Produtos NASA",
    description:
      "Tag 'Produtos NASA' → proposta combo (Setup + Treinamento + Suporte) → mesma cadência longa + 3 toques contrato.",
    triggerTagId: "cmps6lby601fdnoxbsom5utyz",
    triggerTagName: "Produtos NASA",
    productIds: [
      "cmoswhcic001kdaxbfwnoj9ja",
      "cmoswhcie001ldaxbhfijtxsf",
      "cmoswhcif001mdaxb3g60vg3h",
    ],
    proposalSummary: "Setup + Treinamento + Suporte Premium",
  },
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

async function ensureTemplate(): Promise<string> {
  console.log();
  console.log("═ CONTRACT TEMPLATE");
  const existing: Array<{ id: string }> = await prisma.$queryRawUnsafe(
    "SELECT id FROM forge_contract_templates WHERE organization_id = $1 AND name = $2 LIMIT 1",
    ORG_ID,
    TEMPLATE_NAME,
  );
  if (existing[0]) {
    console.log(`  → Template ok (${existing[0].id})`);
    return existing[0].id;
  }
  const templateId = createId();
  const content = `
    <h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
    <p>Pelo presente instrumento, NASA AGENTS LTDA. e {{cliente_nome}}
    celebram o presente contrato, com as seguintes cláusulas:</p>
    <h2>1. Objeto</h2>
    <p>Prestação de serviços conforme proposta vinculada.</p>
    <h2>2. Valor</h2>
    <p>R$ {{valor}}</p>
    <h2>3. Prazo</h2>
    <p>Vigência de {{data_inicio}} a {{data_fim}}.</p>
    <p>Assinatura digital abaixo.</p>
  `.trim();
  await prisma.$executeRawUnsafe(
    "INSERT INTO forge_contract_templates (id, organization_id, name, content, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())",
    templateId,
    ORG_ID,
    TEMPLATE_NAME,
    content,
    RESPONSIBLE_USER_ID,
  );
  console.log(`  ✓ Template criado (${templateId})`);
  return templateId;
}

async function createWorkflow(
  spec: WorkflowSpec,
  tagIds: Record<string, string>,
  templateId: string,
) {
  const prefix = spec.id.replace("wf_proposta_contrato_", "wfpc-");
  const n = (suffix: string) => `${prefix}-${suffix}`;
  console.log();
  console.log(`═ WORKFLOW: ${spec.name}`);

  const existing = await prisma.workflow.findUnique({
    where: { id: spec.id },
    select: { id: true },
  });
  if (existing) {
    await prisma.connection.deleteMany({ where: { workflowId: spec.id } });
    await prisma.node.deleteMany({ where: { workflowId: spec.id } });
    await prisma.workflow.update({
      where: { id: spec.id },
      data: {
        name: spec.name,
        description: spec.description,
        isActive: true,
        agentMode: true,
      },
    });
    console.log(`  → atualizando ${spec.id}`);
  } else {
    await prisma.workflow.create({
      data: {
        id: spec.id,
        tracking: { connect: { id: TRACKING_ID } },
        user: { connect: { id: RESPONSIBLE_USER_ID } },
        name: spec.name,
        description: spec.description,
        isActive: true,
        agentMode: true,
      },
    });
    console.log(`  ✓ criado ${spec.id}`);
  }

  // ── AI_DECISION builder reutilizável ──────────────────────────────
  // Cada rodada da proposta tem 3 branches (aceitou/rejeitou/sem_resposta).
  // Mesma estrutura, prompt levemente customizado pela rodada.
  function buildDecide(
    id: string,
    rodada: number,
    totalRodadas: number,
    position: { x: number; y: number },
  ) {
    const promptBase = `O lead {{lead.name}} interagiu com a proposta de ${spec.proposalSummary}.
Esta é a rodada ${rodada} de ${totalRodadas} (D+0 / D+3 / D+7 / D+15 / D+30 = encerra como Sem interesse).

PRIORIDADE 1 — Evento explícito do sistema (vars.lastEventName):
- "proposal-accepted" ou "contract-signed" → "aceitou"
- "proposal-rejected" → "rejeitou"
- "lead-tagged" → veja {{vars.lastEvent.tagIds}} (mapeado em tagBranchMap)
- "lead-status-changed" → se status virou "Fechado" trate como aceitou; "Perdido" como rejeitou
- vazio (timeout): use defaultBranchId

PRIORIDADE 2 — Texto do lead (vars.lastIncomingMessage):
- ACEITOU: sim, fechado, vamos, ok, pode mandar, manda o contrato, beleza
- REJEITOU: não, sem orçamento, depois, caro, não tenho interesse
- SEM_RESPOSTA: ambíguo, só dúvidas, off-topic

Responda APENAS o id (aceitou | rejeitou | sem_resposta).`;
    return {
      id,
      type: "AI_DECISION",
      position,
      data: {
        prompt: promptBase,
        branches: [
          { id: "aceitou", label: "Aceitou", description: "Lead aceitou" },
          { id: "rejeitou", label: "Rejeitou", description: "Lead recusou" },
          { id: "sem_resposta", label: "Sem resposta", description: "Ambíguo ou silêncio" },
        ],
        organizationId: ORG_ID,
        eventBranchMap: {
          "proposal-accepted": "aceitou",
          "proposal-rejected": "rejeitou",
          "contract-signed": "aceitou",
        },
        tagBranchMap: {
          [tagIds["proposta-aceita"]]: "aceitou",
          [tagIds["recusou-proposta"]]: "rejeitou",
          [tagIds["contrato-assinado"]]: "aceitou",
          [tagIds["sem-interesse"]]: "sem_resposta",
        },
        // ⭐ Default seguro: timeout → SEM_RESPOSTA (não dispara contrato sozinho).
        defaultBranchId: "sem_resposta",
      },
    };
  }

  // AI_DECISION pro bloco contrato — só 2 branches.
  function buildDecideContract(
    id: string,
    rodada: number,
    position: { x: number; y: number },
  ) {
    return {
      id,
      type: "AI_DECISION",
      position,
      data: {
        prompt: `Avaliando se o lead {{lead.name}} já assinou o contrato (rodada ${rodada} de 3).

PRIORIDADE 1 — Evento explícito:
- "contract-signed" → "assinou"
- "lead-tagged" + tag "Contrato Assinado" → "assinou"
- vazio (timeout): defaultBranchId

PRIORIDADE 2 — Texto:
- ASSINOU: "assinei", "pronto", "feito", "concluí"
- NAO_ASSINOU: silêncio, dúvida, "não consigo abrir o link", etc

Responda APENAS o id (assinou | nao_assinou).`,
        branches: [
          { id: "assinou", label: "Assinou", description: "Lead concluiu assinatura" },
          { id: "nao_assinou", label: "Não assinou", description: "Ainda pendente" },
        ],
        organizationId: ORG_ID,
        eventBranchMap: {
          "contract-signed": "assinou",
        },
        tagBranchMap: {
          [tagIds["contrato-assinado"]]: "assinou",
          [tagIds["sem-interesse"]]: "nao_assinou",
        },
        defaultBranchId: "nao_assinou", // timeout = não assinou
      },
    };
  }

  // ── NODES ─────────────────────────────────────────────────────────
  type NodeIn = {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  };

  const waitEvent = (
    suffix: string,
    minutes: number,
    pos: { x: number; y: number },
    events = WAIT_EVENTS_PROPOSTA,
  ): NodeIn => ({
    id: n(suffix),
    type: "WAIT_FOR_EVENT",
    position: pos,
    data: { eventNames: events, timeoutMinutes: minutes },
  });

  const tagNode = (
    suffix: string,
    tagSlug: string,
    pos: { x: number; y: number },
  ): NodeIn => ({
    id: n(suffix),
    type: "TAG",
    position: pos,
    data: { action: { type: "ADD", tagsIds: [tagIds[tagSlug]] } },
  });

  const msgNode = (
    suffix: string,
    message: string,
    pos: { x: number; y: number },
  ): NodeIn => ({
    id: n(suffix),
    type: "SEND_MESSAGE",
    position: pos,
    data: { action: { payload: { type: "TEXT", message } } },
  });

  // Posições: linhas y = -480 / -360 / -240 / -120 / 0 / 120 / 240 / 360
  // Colunas x crescem 320 cada
  const nodes: NodeIn[] = [
    // Trigger + abertura
    {
      id: n("trigger"),
      type: "LEAD_TAGGED",
      position: { x: 0, y: 0 },
      data: { action: { tagIds: [spec.triggerTagId], conditions: [] } },
    },
    tagNode("tag-pendente", "proposta-pendente", { x: 320, y: 0 }),
    {
      id: n("send-proposal"),
      type: "SEND_PROPOSAL",
      position: { x: 640, y: 0 },
      data: {
        action: {
          productIds: spec.productIds,
          responsibleId: RESPONSIBLE_USER_ID,
          validityDays: 30, // bate com fim da cadência
          messageTemplate: `Olá {{nome}}! Segue a proposta {{numero}} (${spec.proposalSummary}) no valor de {{valor}}, válida até {{validade}}. Acesse: {{url}}`,
        },
      },
    },

    // ── Cadência proposta — 4 rodadas em sequência ────────────────
    waitEvent("wait-1", T(1, 4320), { x: 960, y: 0 }), // D+0 → D+3
    buildDecide(n("decide-1"), 1, 4, { x: 1280, y: 0 }) as NodeIn,

    msgNode(
      "msg-d3",
      "Oi {{lead.name}}, deu pra dar uma olhada na proposta? Posso esclarecer alguma dúvida agora?",
      { x: 1280, y: 240 },
    ),
    waitEvent("wait-2", T(1, 5760), { x: 1600, y: 240 }), // D+3 → D+7
    buildDecide(n("decide-2"), 2, 4, { x: 1920, y: 240 }) as NodeIn,

    msgNode(
      "msg-d7",
      "{{lead.name}}, já vi muita gente fechar nessa altura. Tem algo travando aí que eu possa resolver? Posso ajustar a proposta se for o caso.",
      { x: 1920, y: 240 },
    ),
    waitEvent("wait-3", T(1, 11520), { x: 2240, y: 240 }), // D+7 → D+15
    buildDecide(n("decide-3"), 3, 4, { x: 2560, y: 240 }) as NodeIn,

    msgNode(
      "msg-d15",
      "{{lead.name}}, vou deixar um lembrete final por aqui. A proposta vence em alguns dias. Se ainda fizer sentido, é só me dar sinal!",
      { x: 2560, y: 240 },
    ),
    waitEvent("wait-4", T(1, 21600), { x: 2880, y: 240 }), // D+15 → D+30
    buildDecide(n("decide-4"), 4, 4, { x: 3200, y: 240 }) as NodeIn,

    // Terminal sem interesse
    tagNode("tag-sem-interesse", "sem-interesse", { x: 3200, y: 240 }),
    msgNode(
      "msg-handover",
      "Tudo bem, {{lead.name}}! Vou encerrar por aqui. Se mudar de ideia no futuro, é só me chamar. 👋",
      { x: 3520, y: 240 },
    ),

    // Branch rejeitou (compartilhado entre as 4 rodadas)
    tagNode("tag-recusou", "recusou-proposta", { x: 1280, y: 480 }),
    msgNode(
      "msg-thanks",
      "Tudo bem, {{lead.name}}! Obrigado pelo retorno. Se mudar de ideia, é só chamar aqui.",
      { x: 1600, y: 480 },
    ),

    // ── BLOCO CONTRATO ───────────────────────────────────────────
    tagNode("tag-aceita", "proposta-aceita", { x: 1280, y: -240 }),
    {
      id: n("send-contract"),
      type: "SEND_CONTRACT",
      position: { x: 1600, y: -240 },
      data: {
        action: {
          templateContractId: templateId,
          messageTemplate:
            "Show, {{nome}}! Segue o contrato pra assinatura: {{url}}",
        },
      },
    },
    waitEvent("wait-c1", T(1, 4320), { x: 1920, y: -240 }, WAIT_EVENTS_CONTRATO), // D+0 → D+3
    buildDecideContract(n("decide-c1"), 1, { x: 2240, y: -240 }) as NodeIn,

    msgNode(
      "msg-c-d3",
      "Oi {{lead.name}}! Vi que o contrato ainda não foi assinado. Link de novo aqui — qualquer coisa é só me avisar.",
      { x: 2240, y: -120 },
    ),
    waitEvent("wait-c2", T(1, 5760), { x: 2560, y: -120 }, WAIT_EVENTS_CONTRATO),
    buildDecideContract(n("decide-c2"), 2, { x: 2880, y: -120 }) as NodeIn,

    msgNode(
      "msg-c-d7",
      "{{lead.name}}, vou ter que anular o contrato em alguns dias se não conseguir assinar. Se tiver alguma dificuldade, me avisa que eu te ajudo.",
      { x: 2880, y: -120 },
    ),
    waitEvent("wait-c3", T(1, 10080), { x: 3200, y: -120 }, WAIT_EVENTS_CONTRATO),
    buildDecideContract(n("decide-c3"), 3, { x: 3520, y: -120 }) as NodeIn,

    // Terminal feliz contrato
    tagNode("tag-assinado", "contrato-assinado", { x: 3520, y: -240 }),
    msgNode(
      "msg-welcome",
      "Show, {{lead.name}}! Contrato assinado. Bem-vindo(a) à NASA Agents. Em breve nosso time entra em contato com os próximos passos. 🚀",
      { x: 3840, y: -240 },
    ),
  ];

  for (const nd of nodes) {
    await prisma.node.create({
      data: {
        id: nd.id,
        workflow: { connect: { id: spec.id } },
        name: nd.type,
        type: nd.type as never,
        position: nd.position,
        data: nd.data as never,
      },
    });
  }

  // ── CONNECTIONS ──────────────────────────────────────────────────
  const conns: Array<{ from: string; to: string; out?: string }> = [
    // Cadência principal
    { from: n("trigger"), to: n("tag-pendente") },
    { from: n("tag-pendente"), to: n("send-proposal") },
    { from: n("send-proposal"), to: n("wait-1") },
    { from: n("wait-1"), to: n("decide-1") },

    // Decide-1 → 3 destinos
    { from: n("decide-1"), to: n("tag-aceita"), out: "aceitou" },
    { from: n("decide-1"), to: n("tag-recusou"), out: "rejeitou" },
    { from: n("decide-1"), to: n("msg-d3"), out: "sem_resposta" },

    { from: n("msg-d3"), to: n("wait-2") },
    { from: n("wait-2"), to: n("decide-2") },
    { from: n("decide-2"), to: n("tag-aceita"), out: "aceitou" },
    { from: n("decide-2"), to: n("tag-recusou"), out: "rejeitou" },
    { from: n("decide-2"), to: n("msg-d7"), out: "sem_resposta" },

    { from: n("msg-d7"), to: n("wait-3") },
    { from: n("wait-3"), to: n("decide-3") },
    { from: n("decide-3"), to: n("tag-aceita"), out: "aceitou" },
    { from: n("decide-3"), to: n("tag-recusou"), out: "rejeitou" },
    { from: n("decide-3"), to: n("msg-d15"), out: "sem_resposta" },

    { from: n("msg-d15"), to: n("wait-4") },
    { from: n("wait-4"), to: n("decide-4") },
    { from: n("decide-4"), to: n("tag-aceita"), out: "aceitou" },
    { from: n("decide-4"), to: n("tag-recusou"), out: "rejeitou" },
    { from: n("decide-4"), to: n("tag-sem-interesse"), out: "sem_resposta" },

    // Terminal sem interesse (proposta)
    { from: n("tag-sem-interesse"), to: n("msg-handover") },

    // Branch rejeitou compartilhado
    { from: n("tag-recusou"), to: n("msg-thanks") },

    // Bloco contrato
    { from: n("tag-aceita"), to: n("send-contract") },
    { from: n("send-contract"), to: n("wait-c1") },
    { from: n("wait-c1"), to: n("decide-c1") },
    { from: n("decide-c1"), to: n("tag-assinado"), out: "assinou" },
    { from: n("decide-c1"), to: n("msg-c-d3"), out: "nao_assinou" },

    { from: n("msg-c-d3"), to: n("wait-c2") },
    { from: n("wait-c2"), to: n("decide-c2") },
    { from: n("decide-c2"), to: n("tag-assinado"), out: "assinou" },
    { from: n("decide-c2"), to: n("msg-c-d7"), out: "nao_assinou" },

    { from: n("msg-c-d7"), to: n("wait-c3") },
    { from: n("wait-c3"), to: n("decide-c3") },
    { from: n("decide-c3"), to: n("tag-assinado"), out: "assinou" },
    // Sem assinar após 3 tentativas → reutiliza tag-sem-interesse
    { from: n("decide-c3"), to: n("tag-sem-interesse"), out: "nao_assinou" },

    // Terminal feliz
    { from: n("tag-assinado"), to: n("msg-welcome") },
  ];

  for (const c of conns) {
    await prisma.connection.create({
      data: {
        id: createId(),
        workflow: { connect: { id: spec.id } },
        fromNode: { connect: { id: c.from } },
        toNode: { connect: { id: c.to } },
        fromOutput: c.out ?? "main",
        toInput: "main",
      },
    });
  }
  console.log(`  ✓ ${nodes.length} nodes + ${conns.length} conns`);

  // Validação
  const { validateWorkflowGraph } = await import(
    "../src/features/workflows/lib/validate-workflow-graph"
  );
  const v = await validateWorkflowGraph(spec.id);
  console.log(`  ─ valid=${v.valid} issues=${v.issues.length}`);
  for (const i of v.issues.slice(0, 5))
    console.log(`     [${i.severity}] ${i.code} ${i.message.slice(0, 90)}`);
}

async function main() {
  console.log(
    TEST_MODE
      ? "▸ TEST_MODE=true (waits comprimidos pra 1min cada — pra teste de sessão)"
      : "▸ TEST_MODE=false (waits em dias reais: 3/4/8/15 proposta + 3/4/7 contrato)",
  );
  console.log();
  const tagIds = await ensureTags();
  const templateId = await ensureTemplate();
  for (const spec of WORKFLOWS) {
    await createWorkflow(spec, tagIds, templateId);
  }
  console.log();
  console.log("═══════════════════════════════════════");
  console.log(`✓ ${WORKFLOWS.length} workflows criados/atualizados`);
  console.log("═══════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("✗ Falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
