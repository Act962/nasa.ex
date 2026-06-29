/**
 * Preset "Proposta + Contrato — Fechamento Automático" — cadência longa
 * (D+0 / D+3 / D+7 / D+15 / D+30) com 3 caminhos em race no WAIT_FOR_EVENT:
 *
 *   A. Lead responde por TEXTO no WhatsApp           → message-incoming
 *   B. Lead clica no FORGE (Aceitar/Recusar/Assinar) → proposal-accepted/rejected, contract-signed
 *   C. USER aplica TAG/STATUS manualmente            → lead-tagged, lead-status-changed
 *
 * Qualquer um desbloqueia o WAIT_FOR_EVENT (Promise.race no inngest). O
 * AI_DECISION (com fallback heurístico event-match) escolhe a branch
 * baseado em:
 *   1. Evento explícito (eventBranchMap)         — confiança 1.0, sem LLM
 *   2. Tag aplicada manualmente (tagBranchMap)   — confiança 1.0, sem LLM
 *   3. Texto do lead (LLM ou Jaccard fallback)   — confiança variável
 *   4. Timeout (defaultBranchId)                  — sempre "sem_resposta"
 *      pra fluxos de proposta (evita disparar contrato no silêncio)
 *
 * Estrutura completa (30 nodes / 38 conns):
 *
 *   LEAD_TAGGED(<<triggerTag>>)
 *     → TAG Pendente
 *     → SEND_PROPOSAL
 *     → WAIT_FOR_EVENT[5 eventos] (3d)         ← rodada 1
 *     → AI_DECISION_1
 *         ├ aceitou → [BLOCO CONTRATO]
 *         ├ rejeitou → TAG Recusou → SEND_MESSAGE thanks
 *         └ sem_resposta:
 *             → SEND_MESSAGE D+3 "Deu pra ver?"
 *             → WAIT_FOR_EVENT (4d) → AI_DECISION_2 (mesmas branches)
 *                 └ sem_resposta:
 *                     → SEND_MESSAGE D+7 "Alguma dúvida?"
 *                     → WAIT_FOR_EVENT (8d) → AI_DECISION_3
 *                         └ sem_resposta:
 *                             → SEND_MESSAGE D+15 "Última chamada"
 *                             → WAIT_FOR_EVENT (15d) → AI_DECISION_4
 *                                 └ sem_resposta:
 *                                     → TAG "Sem interesse" → SEND_MESSAGE handover
 *
 *   [BLOCO CONTRATO] (compartilhado por todas as branches aceitou):
 *     → TAG Aceita → SEND_CONTRACT (cria ForgeContract auto-signer = lead)
 *     → WAIT_FOR_EVENT[3 eventos] (3d) → AI_DECISION_C1 (assinou/nao_assinou)
 *         ├ assinou → TAG Assinado → SEND_MESSAGE boas-vindas
 *         └ nao_assinou:
 *             → SEND_MESSAGE "Falta assinar" (D+3)
 *             → WAIT_FOR_EVENT (4d) → AI_DECISION_C2
 *                 ├ assinou → TAG Assinado
 *                 └ nao_assinou:
 *                     → SEND_MESSAGE "Vou anular em 24h" (D+7)
 *                     → WAIT_FOR_EVENT (7d) → AI_DECISION_C3
 *                         ├ assinou → TAG Assinado
 *                         └ nao_assinou → TAG "Sem interesse" (reusa terminal)
 *
 * Placeholders <<...>> a substituir no canvas pela operadora antes de ativar:
 *   <<TRIGGER_TAG_ID>>             Tag que dispara (ex: "Consultoria NASA")
 *   <<PRODUCT_IDS>>                ForgeProduct.id[] da proposta
 *   <<RESPONSIBLE_USER_ID>>        User da org (cuid do better-auth)
 *   <<TEMPLATE_CONTRACT_ID>>       ForgeContractTemplate.id
 *   <<TAG_PROPOSTA_PENDENTE_ID>>
 *   <<TAG_PROPOSTA_ACEITA_ID>>
 *   <<TAG_CONTRATO_ASSINADO_ID>>
 *   <<TAG_RECUSOU_ID>>
 *   <<TAG_SEM_INTERESSE_ID>>
 *
 * O builder aceita params concretos quando já se tem os IDs (ex: scripts
 * de setup que conhecem a org), ou usa placeholders se rodar com defaults.
 */
import { createId } from "@paralleldrive/cuid2";
import { NodeType } from "@/generated/prisma/enums";

export interface PropostaContratoParams {
  organizationId: string;
  trackingId: string;
  /** Nome do workflow (ex: "Proposta + Contrato — Consultoria NASA"). */
  name?: string;
  /** Descrição curta do produto/pacote (interpolada nos templates de msg). */
  proposalSummary?: string;
  /** Tag que dispara (ex: ID da tag "Consultoria NASA"). */
  triggerTagId?: string;
  /** Produtos a incluir na proposta. */
  productIds?: string[];
  /** User responsável pela proposta (default: placeholder). */
  responsibleUserId?: string;
  /** Template do contrato. */
  templateContractId?: string;
  /** Tags de estado. */
  tagPropostaPendenteId?: string;
  tagPropostaAceitaId?: string;
  tagContratoAssinadoId?: string;
  tagRecusouId?: string;
  tagSemInteresseId?: string;
  /**
   * Sobrescreve a cadência de waits (minutos). Default = produção.
   *   - waitMinutesProposta: [3d, 4d, 8d, 15d]
   *   - waitMinutesContrato: [3d, 4d, 7d]
   *
   * Pra testes em sessão, passa `[1, 1, 1, 1]` e `[1, 1, 1]`.
   */
  waitMinutesProposta?: [number, number, number, number];
  waitMinutesContrato?: [number, number, number];
}

// Eventos que TODOS os WAIT_FOR_EVENT da proposta escutam em race.
// Qualquer um desbloqueia: clique no Forge, texto WhatsApp, tag/status manual.
const WAIT_EVENTS_PROPOSTA = [
  "proposal-accepted",
  "proposal-rejected",
  "message-incoming",
  "lead-tagged",
  "lead-status-changed",
] as const;

// Bloco contrato foca em assinatura, mas aceita texto/tag pra fallback.
const WAIT_EVENTS_CONTRATO = [
  "contract-signed",
  "message-incoming",
  "lead-tagged",
] as const;

const PROD_WAITS_PROPOSTA: [number, number, number, number] = [
  4320, // 3d  — D+0 → D+3
  5760, // 4d  — D+3 → D+7
  11520, // 8d  — D+7 → D+15
  21600, // 15d — D+15 → D+30
];

const PROD_WAITS_CONTRATO: [number, number, number] = [
  4320, // 3d
  5760, // 4d
  10080, // 7d
];

export function buildPropostaContratoBlueprint(params: PropostaContratoParams) {
  const summary = params.proposalSummary ?? "<<DESCRIÇÃO_DO_PACOTE>>";
  const waitP = params.waitMinutesProposta ?? PROD_WAITS_PROPOSTA;
  const waitC = params.waitMinutesContrato ?? PROD_WAITS_CONTRATO;

  // Placeholders pra valores opcionais — operador substitui no canvas.
  const PH_TRIGGER = params.triggerTagId ?? "<<TRIGGER_TAG_ID>>";
  const PH_PRODUCTS = params.productIds ?? ["<<PRODUCT_IDS>>"];
  const PH_RESPONSIBLE = params.responsibleUserId ?? "<<RESPONSIBLE_USER_ID>>";
  const PH_TEMPLATE = params.templateContractId ?? "<<TEMPLATE_CONTRACT_ID>>";
  const PH_TAG_PENDENTE =
    params.tagPropostaPendenteId ?? "<<TAG_PROPOSTA_PENDENTE_ID>>";
  const PH_TAG_ACEITA =
    params.tagPropostaAceitaId ?? "<<TAG_PROPOSTA_ACEITA_ID>>";
  const PH_TAG_ASSINADO =
    params.tagContratoAssinadoId ?? "<<TAG_CONTRATO_ASSINADO_ID>>";
  const PH_TAG_RECUSOU = params.tagRecusouId ?? "<<TAG_RECUSOU_ID>>";
  const PH_TAG_SEM_INTERESSE =
    params.tagSemInteresseId ?? "<<TAG_SEM_INTERESSE_ID>>";

  // IDs declarativos — o aplicador (`apply-default-presets`) substitui por
  // cuids reais via idMap. Mantém legível pra debug do blueprint.
  const ids = {
    trigger: "trg-lead-tagged",
    tagPendente: "tag-pendente",
    sendProposal: "send-proposal",

    wait1: "wait-1",
    decide1: "decide-1",
    msgD3: "msg-d3",
    wait2: "wait-2",
    decide2: "decide-2",
    msgD7: "msg-d7",
    wait3: "wait-3",
    decide3: "decide-3",
    msgD15: "msg-d15",
    wait4: "wait-4",
    decide4: "decide-4",

    // Terminais proposta
    tagSemInteresse: "tag-sem-interesse",
    msgHandover: "msg-handover",
    tagRecusou: "tag-recusou",
    msgThanks: "msg-thanks",

    // Bloco contrato (compartilhado pelas 4 rodadas aceitou)
    tagAceita: "tag-aceita",
    sendContract: "send-contract",
    waitC1: "wait-c1",
    decideC1: "decide-c1",
    msgCD3: "msg-c-d3",
    waitC2: "wait-c2",
    decideC2: "decide-c2",
    msgCD7: "msg-c-d7",
    waitC3: "wait-c3",
    decideC3: "decide-c3",

    // Terminal feliz contrato
    tagAssinado: "tag-assinado",
    msgWelcome: "msg-welcome",
  } as const;

  type Node = {
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  };

  // ── Helpers de construção ────────────────────────────────────────
  const tagNode = (
    id: string,
    tagId: string,
    position: { x: number; y: number },
  ): Node => ({
    id,
    type: NodeType.TAG,
    position,
    data: { action: { type: "ADD", tagsIds: [tagId] } },
  });

  const msgNode = (
    id: string,
    message: string,
    position: { x: number; y: number },
  ): Node => ({
    id,
    type: NodeType.SEND_MESSAGE,
    position,
    data: { action: { payload: { type: "TEXT", message } } },
  });

  const waitNode = (
    id: string,
    minutes: number,
    position: { x: number; y: number },
    events: readonly string[] = WAIT_EVENTS_PROPOSTA,
  ): Node => ({
    id,
    type: NodeType.WAIT_FOR_EVENT,
    position,
    data: { eventNames: [...events], timeoutMinutes: minutes },
  });

  // AI_DECISION pra proposta (3 branches). Mesmo prompt/mapas em todas as
  // rodadas — só muda position e rotulagem da rodada.
  const decideProposta = (
    id: string,
    rodada: number,
    total: number,
    position: { x: number; y: number },
  ): Node => ({
    id,
    type: NodeType.AI_DECISION,
    position,
    data: {
      prompt: `O lead {{lead.name}} interagiu com a proposta de ${summary}.
Esta é a rodada ${rodada} de ${total} (D+0 / D+3 / D+7 / D+15 / D+30 = encerra como "Sem interesse").

PRIORIDADE 1 — Evento explícito do sistema ({{vars.lastEventName}}):
- "proposal-accepted" ou "contract-signed" → "aceitou"
- "proposal-rejected" → "rejeitou"
- "lead-tagged" → veja {{vars.lastEvent.tagIds}} (mapeado em tagBranchMap)
- "lead-status-changed" → "Fechado" = aceitou; "Perdido" = rejeitou
- vazio (timeout) → defaultBranchId = sem_resposta

PRIORIDADE 2 — Texto do lead ({{vars.lastIncomingMessage}}):
- ACEITOU: sim, fechado, vamos, ok, pode mandar, manda o contrato, beleza
- REJEITOU: não, sem orçamento, depois, caro, não tenho interesse
- SEM_RESPOSTA: ambíguo, só dúvidas, off-topic

Responda APENAS o id (aceitou | rejeitou | sem_resposta).`,
      branches: [
        { id: "aceitou", label: "Aceitou", description: "Lead aceitou" },
        { id: "rejeitou", label: "Rejeitou", description: "Lead recusou" },
        { id: "sem_resposta", label: "Sem resposta", description: "Ambíguo ou silêncio" },
      ],
      organizationId: params.organizationId,
      eventBranchMap: {
        "proposal-accepted": "aceitou",
        "proposal-rejected": "rejeitou",
        "contract-signed": "aceitou",
      },
      // Quando o operador substituir os placeholders pelos cuids reais,
      // esse mapa já fica pronto. Enquanto for placeholder, ele só é
      // ignorado em runtime (não bate com nenhuma tag real).
      tagBranchMap: {
        [PH_TAG_ACEITA]: "aceitou",
        [PH_TAG_RECUSOU]: "rejeitou",
        [PH_TAG_ASSINADO]: "aceitou",
        [PH_TAG_SEM_INTERESSE]: "sem_resposta",
      },
      // ⭐ CRÍTICO: timeout → "sem_resposta", nunca "aceitou".
      // Sem isso, lead sumir = fluxo dispara contrato sozinho.
      defaultBranchId: "sem_resposta",
    },
  });

  const decideContrato = (
    id: string,
    rodada: number,
    position: { x: number; y: number },
  ): Node => ({
    id,
    type: NodeType.AI_DECISION,
    position,
    data: {
      prompt: `Avaliando se o lead {{lead.name}} já assinou o contrato (rodada ${rodada} de 3).

PRIORIDADE 1 — Evento explícito:
- "contract-signed" → "assinou"
- "lead-tagged" + tag "Contrato Assinado" → "assinou"
- vazio (timeout) → defaultBranchId = nao_assinou

PRIORIDADE 2 — Texto:
- ASSINOU: "assinei", "pronto", "feito", "concluí"
- NAO_ASSINOU: silêncio, dúvida, "não consigo abrir o link"

Responda APENAS o id (assinou | nao_assinou).`,
      branches: [
        { id: "assinou", label: "Assinou", description: "Lead concluiu assinatura" },
        { id: "nao_assinou", label: "Não assinou", description: "Ainda pendente" },
      ],
      organizationId: params.organizationId,
      eventBranchMap: { "contract-signed": "assinou" },
      tagBranchMap: {
        [PH_TAG_ASSINADO]: "assinou",
        [PH_TAG_SEM_INTERESSE]: "nao_assinou",
      },
      defaultBranchId: "nao_assinou",
    },
  });

  // ── Nodes ────────────────────────────────────────────────────────
  const nodes: Node[] = [
    // Cadência principal — linha y=0
    {
      id: ids.trigger,
      type: NodeType.LEAD_TAGGED,
      position: { x: 0, y: 0 },
      data: { action: { tagIds: [PH_TRIGGER], conditions: [] } },
    },
    tagNode(ids.tagPendente, PH_TAG_PENDENTE, { x: 320, y: 0 }),
    {
      id: ids.sendProposal,
      type: NodeType.SEND_PROPOSAL,
      position: { x: 640, y: 0 },
      data: {
        action: {
          productIds: PH_PRODUCTS,
          responsibleId: PH_RESPONSIBLE,
          validityDays: 30,
          messageTemplate: `Olá {{nome}}! Segue a proposta {{numero}} (${summary}) no valor de {{valor}}, válida até {{validade}}. Acesse: {{url}}`,
        },
      },
    },

    // Rodada 1
    waitNode(ids.wait1, waitP[0], { x: 960, y: 0 }),
    decideProposta(ids.decide1, 1, 4, { x: 1280, y: 0 }),

    // Rodada 2
    msgNode(
      ids.msgD3,
      "Oi {{lead.name}}, deu pra dar uma olhada na proposta? Posso esclarecer alguma dúvida agora?",
      { x: 1280, y: 240 },
    ),
    waitNode(ids.wait2, waitP[1], { x: 1600, y: 240 }),
    decideProposta(ids.decide2, 2, 4, { x: 1920, y: 240 }),

    // Rodada 3
    msgNode(
      ids.msgD7,
      "{{lead.name}}, já vi muita gente fechar nessa altura. Tem algo travando aí que eu possa resolver? Posso ajustar a proposta se for o caso.",
      { x: 1920, y: 240 },
    ),
    waitNode(ids.wait3, waitP[2], { x: 2240, y: 240 }),
    decideProposta(ids.decide3, 3, 4, { x: 2560, y: 240 }),

    // Rodada 4
    msgNode(
      ids.msgD15,
      "{{lead.name}}, vou deixar um lembrete final por aqui. A proposta vence em alguns dias. Se ainda fizer sentido, é só me dar sinal!",
      { x: 2560, y: 240 },
    ),
    waitNode(ids.wait4, waitP[3], { x: 2880, y: 240 }),
    decideProposta(ids.decide4, 4, 4, { x: 3200, y: 240 }),

    // Terminal sem interesse (proposta)
    tagNode(ids.tagSemInteresse, PH_TAG_SEM_INTERESSE, { x: 3200, y: 240 }),
    msgNode(
      ids.msgHandover,
      "Tudo bem, {{lead.name}}! Vou encerrar por aqui. Se mudar de ideia no futuro, é só me chamar. 👋",
      { x: 3520, y: 240 },
    ),

    // Branch rejeitou compartilhado
    tagNode(ids.tagRecusou, PH_TAG_RECUSOU, { x: 1280, y: 480 }),
    msgNode(
      ids.msgThanks,
      "Tudo bem, {{lead.name}}! Obrigado pelo retorno. Se mudar de ideia, é só chamar aqui.",
      { x: 1600, y: 480 },
    ),

    // ── BLOCO CONTRATO ───────────────────────────────────────────
    tagNode(ids.tagAceita, PH_TAG_ACEITA, { x: 1280, y: -240 }),
    {
      id: ids.sendContract,
      type: NodeType.SEND_CONTRACT,
      position: { x: 1600, y: -240 },
      data: {
        action: {
          templateContractId: PH_TEMPLATE,
          messageTemplate:
            "Show, {{nome}}! Segue o contrato pra assinatura: {{url}}",
        },
      },
    },
    waitNode(ids.waitC1, waitC[0], { x: 1920, y: -240 }, WAIT_EVENTS_CONTRATO),
    decideContrato(ids.decideC1, 1, { x: 2240, y: -240 }),

    msgNode(
      ids.msgCD3,
      "Oi {{lead.name}}! Vi que o contrato ainda não foi assinado. Link de novo aqui — qualquer coisa é só me avisar.",
      { x: 2240, y: -120 },
    ),
    waitNode(ids.waitC2, waitC[1], { x: 2560, y: -120 }, WAIT_EVENTS_CONTRATO),
    decideContrato(ids.decideC2, 2, { x: 2880, y: -120 }),

    msgNode(
      ids.msgCD7,
      "{{lead.name}}, vou ter que anular o contrato em alguns dias se não conseguir assinar. Se tiver alguma dificuldade, me avisa que eu te ajudo.",
      { x: 2880, y: -120 },
    ),
    waitNode(ids.waitC3, waitC[2], { x: 3200, y: -120 }, WAIT_EVENTS_CONTRATO),
    decideContrato(ids.decideC3, 3, { x: 3520, y: -120 }),

    // Terminal feliz contrato
    tagNode(ids.tagAssinado, PH_TAG_ASSINADO, { x: 3520, y: -240 }),
    msgNode(
      ids.msgWelcome,
      "Show, {{lead.name}}! Contrato assinado. Bem-vindo(a) à NASA Agents. Em breve nosso time entra em contato com os próximos passos. 🚀",
      { x: 3840, y: -240 },
    ),
  ];

  // ── Edges ────────────────────────────────────────────────────────
  type Edge = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    fromOutput: string;
    toInput: string;
  };
  const edge = (from: string, to: string, out = "main"): Edge => ({
    id: createId(),
    fromNodeId: from,
    toNodeId: to,
    fromOutput: out,
    toInput: "main",
  });

  const edges: Edge[] = [
    // Cadência principal
    edge(ids.trigger, ids.tagPendente),
    edge(ids.tagPendente, ids.sendProposal),
    edge(ids.sendProposal, ids.wait1),
    edge(ids.wait1, ids.decide1),

    // Decide-1 → 3 destinos (aceitou/rejeitou compartilhados)
    edge(ids.decide1, ids.tagAceita, "aceitou"),
    edge(ids.decide1, ids.tagRecusou, "rejeitou"),
    edge(ids.decide1, ids.msgD3, "sem_resposta"),

    edge(ids.msgD3, ids.wait2),
    edge(ids.wait2, ids.decide2),
    edge(ids.decide2, ids.tagAceita, "aceitou"),
    edge(ids.decide2, ids.tagRecusou, "rejeitou"),
    edge(ids.decide2, ids.msgD7, "sem_resposta"),

    edge(ids.msgD7, ids.wait3),
    edge(ids.wait3, ids.decide3),
    edge(ids.decide3, ids.tagAceita, "aceitou"),
    edge(ids.decide3, ids.tagRecusou, "rejeitou"),
    edge(ids.decide3, ids.msgD15, "sem_resposta"),

    edge(ids.msgD15, ids.wait4),
    edge(ids.wait4, ids.decide4),
    edge(ids.decide4, ids.tagAceita, "aceitou"),
    edge(ids.decide4, ids.tagRecusou, "rejeitou"),
    edge(ids.decide4, ids.tagSemInteresse, "sem_resposta"),

    // Terminais
    edge(ids.tagSemInteresse, ids.msgHandover),
    edge(ids.tagRecusou, ids.msgThanks),

    // Bloco contrato
    edge(ids.tagAceita, ids.sendContract),
    edge(ids.sendContract, ids.waitC1),
    edge(ids.waitC1, ids.decideC1),
    edge(ids.decideC1, ids.tagAssinado, "assinou"),
    edge(ids.decideC1, ids.msgCD3, "nao_assinou"),

    edge(ids.msgCD3, ids.waitC2),
    edge(ids.waitC2, ids.decideC2),
    edge(ids.decideC2, ids.tagAssinado, "assinou"),
    edge(ids.decideC2, ids.msgCD7, "nao_assinou"),

    edge(ids.msgCD7, ids.waitC3),
    edge(ids.waitC3, ids.decideC3),
    edge(ids.decideC3, ids.tagAssinado, "assinou"),
    // Sem assinar após 3 tentativas → reutiliza terminal "Sem interesse"
    edge(ids.decideC3, ids.tagSemInteresse, "nao_assinou"),

    // Terminal feliz
    edge(ids.tagAssinado, ids.msgWelcome),
  ];

  return {
    name: params.name ?? "Proposta + Contrato — Fechamento Automático",
    description:
      "Quando o lead recebe a tag-gatilho, envia proposta automaticamente. Espera resposta com cadência longa (D+0/3/7/15/30) — qualquer um dos 5 sinais desbloqueia: lead clica no Forge (aceitar/recusar), responde texto, ou user/IA aplica tag/status manualmente. Se aceitou, manda contrato com 3 toques de assinatura. SEND_CONTRACT cria contrato auto com nome do lead. Sem resposta após 30 dias → tag 'Sem interesse'.",
    nodes,
    edges,
  };
}
