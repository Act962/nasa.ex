import type { PresetSpec } from "@/features/tracking-presets/lib/preset-spec.schema";

/**
 * Preset "Comercial — Menu Interativo": 4 padrões reativos baseados em
 * escolha do lead num menu de WhatsApp. Cada padrão usa a MESMA cadência
 * de follow-up (1/2/3/4/5/7/15/20/30/90 dias) com tag final "Sem interesse".
 *
 * Os 4 workflows são distintos no entry-point e na ação principal:
 *  1. AGENDAMENTO     — envia agenda, oferece reagendar, depois cadência
 *  2. PRODUTOS        — escolha → proposta → contrato; senão cadência
 *  3. INTERESSE       — recompra/reconquista; senão cadência
 *  4. COMPRA + COMPROVANTE — IA Vision identifica pagamento; senão cadência
 *
 * Todos rodam em `agentMode=true` pra usar AI_DECISION nas saídas
 * antecipadas ("lead engajou? sai do loop").
 *
 * Helper `buildCadenceChain` gera os 10 níveis de follow-up sem
 * copiar/colar — recebe contexto e devolve nodes+connections prontos
 * pra colar no workflow.
 */

const FOLLOW_UP_LEVELS = [
  { day: 1, slug: "follow-1" },
  { day: 2, slug: "follow-2" },
  { day: 3, slug: "follow-3" },
  { day: 4, slug: "follow-4" },
  { day: 5, slug: "follow-5" },
  { day: 7, slug: "follow-7" },
  { day: 15, slug: "follow-15" },
  { day: 20, slug: "follow-20" },
  { day: 30, slug: "follow-30" },
  { day: 90, slug: "follow-90" },
] as const;

type Position = { x: number; y: number };
type NodeOut = {
  tempId: string;
  type: string;
  position: Position;
  data: Record<string, unknown>;
};
type ConnOut = {
  fromTempId: string;
  toTempId: string;
  fromOutput: string;
  toInput: string;
};

interface CadenceArgs {
  /** Prefixo único por workflow pra evitar colisão de tempIds entre cadências. */
  prefix: string;
  /** TempId do nó anterior que conecta no 1º WAIT da cadência. */
  fromTempId: string;
  /** Slug da tag de "lead engajou" que faz sair antecipadamente. */
  engagedTagSlug: string;
  /** Slug da tag final ("sem-interesse") aplicada ao fim do loop. */
  exitTagSlug: string;
  /** Mensagem-base do follow-up — `{level}` é substituído pelo número. */
  messageTemplate: (level: number, day: number) => string;
  /** Offset Y inicial pra empilhar nodes (workflows em pilha). */
  yStart?: number;
}

/**
 * Constrói cadência de follow-up: WAIT → AI_DECISION → branches.
 *
 *   WAIT(d) → AI_DECISION
 *     ├─ "engajou" → TAG(engaged) → SEND_MESSAGE("ok, te ajudo agora") → fim
 *     └─ "ignorou" → TAG(follow-N) → SEND_MESSAGE(template) → próximo nível
 *
 * Após o 10º nível, aplica `exitTagSlug` ("sem-interesse") e termina.
 */
function buildCadenceChain(args: CadenceArgs): {
  nodes: NodeOut[];
  connections: ConnOut[];
  /** TempId do último nó útil (TAG sem-interesse) — pra encadear se quiser. */
  lastTempId: string;
} {
  const { prefix, fromTempId, engagedTagSlug, exitTagSlug, messageTemplate } =
    args;
  const yStart = args.yStart ?? 200;
  const nodes: NodeOut[] = [];
  const connections: ConnOut[] = [];
  let prevTempId = fromTempId;

  // Espaçamento dos níveis na vertical pra workflow ficar legível no canvas
  const ROW_HEIGHT = 140;

  // Deltas entre níveis em dias — base pra cálculo do WAIT de cada step
  const deltas: number[] = [];
  for (let i = 0; i < FOLLOW_UP_LEVELS.length; i++) {
    if (i === 0) {
      deltas.push(FOLLOW_UP_LEVELS[i].day);
    } else {
      deltas.push(FOLLOW_UP_LEVELS[i].day - FOLLOW_UP_LEVELS[i - 1].day);
    }
  }

  FOLLOW_UP_LEVELS.forEach((level, i) => {
    const y = yStart + i * ROW_HEIGHT * 2;
    const delta = deltas[i];

    // WAIT entre follow-ups
    const waitId = `${prefix}-wait-${level.slug}`;
    nodes.push({
      tempId: waitId,
      type: "WAIT",
      position: { x: 0, y },
      data: { action: { type: "days", days: delta } },
    });
    connections.push({ fromTempId: prevTempId, toTempId: waitId, fromOutput: "main", toInput: "main" });

    // AI_DECISION — engajou ou ignorou?
    const decisionId = `${prefix}-decision-${level.slug}`;
    nodes.push({
      tempId: decisionId,
      type: "AI_DECISION",
      position: { x: 320, y },
      data: {
        prompt:
          `Lead {{lead.name}} está no follow-up nível ${level.day} dia(s). ` +
          `Olhe o histórico de conversa: ele demonstrou engajamento real ` +
          `(quer falar, responde de volta, faz pergunta nova) ou continua ` +
          `ignorando/desinteressado?`,
        branches: [
          {
            id: "engajou",
            label: "Engajou",
            description: "Lead respondeu mostrando interesse real",
          },
          {
            id: "ignorou",
            label: "Ignorou",
            description: "Lead silenciou ou disse 'agora não'",
          },
        ],
      },
    });
    connections.push({ fromTempId: waitId, toTempId: decisionId, fromOutput: "main", toInput: "main" });

    // Branch "engajou" → TAG engaged + mensagem rápida + sair
    const engagedTagId = `${prefix}-engaged-tag-${level.slug}`;
    nodes.push({
      tempId: engagedTagId,
      type: "TAG",
      position: { x: 640, y: y - 50 },
      data: { action: { type: "ADD", tagSlugs: [engagedTagSlug] } },
    });
    connections.push({
      fromTempId: decisionId,
      toTempId: engagedTagId,
      fromOutput: "engajou",
      toInput: "target-1",
    });
    const engagedMsgId = `${prefix}-engaged-msg-${level.slug}`;
    nodes.push({
      tempId: engagedMsgId,
      type: "SEND_MESSAGE",
      position: { x: 960, y: y - 50 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              `Que ótimo, {{lead.name}}! Te ajudo agora. Vou te chamar em ` +
              `instantes pra fechar.`,
          },
        },
      },
    });
    connections.push({ fromTempId: engagedTagId, toTempId: engagedMsgId, fromOutput: "main", toInput: "main" });

    // Branch "ignorou" → TAG follow-N + mensagem follow-up + próximo nível
    const followTagId = `${prefix}-tag-${level.slug}`;
    nodes.push({
      tempId: followTagId,
      type: "TAG",
      position: { x: 640, y: y + 50 },
      data: { action: { type: "ADD", tagSlugs: [level.slug] } },
    });
    connections.push({
      fromTempId: decisionId,
      toTempId: followTagId,
      fromOutput: "ignorou",
      toInput: "target-1",
    });
    const followMsgId = `${prefix}-msg-${level.slug}`;
    nodes.push({
      tempId: followMsgId,
      type: "SEND_MESSAGE",
      position: { x: 960, y: y + 50 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message: messageTemplate(level.day, delta),
          },
        },
      },
    });
    connections.push({ fromTempId: followTagId, toTempId: followMsgId, fromOutput: "main", toInput: "main" });

    prevTempId = followMsgId;
  });

  // Após o último follow-up: TAG sem-interesse + mensagem de despedida
  const exitY = yStart + FOLLOW_UP_LEVELS.length * 140 * 2;
  const exitTagId = `${prefix}-exit-tag`;
  nodes.push({
    tempId: exitTagId,
    type: "TAG",
    position: { x: 0, y: exitY },
    data: { action: { type: "ADD", tagSlugs: [exitTagSlug] } },
  });
  connections.push({ fromTempId: prevTempId, toTempId: exitTagId, fromOutput: "main", toInput: "main" });

  return { nodes, connections, lastTempId: exitTagId };
}

// ─────────────────────────────────────────────────────────────────────────
// PRESET SPEC
// ─────────────────────────────────────────────────────────────────────────

const buildWorkflow1Agendamento = () => {
  const head: NodeOut[] = [
    {
      tempId: "wf1-trigger",
      type: "LEAD_TAGGED",
      position: { x: 0, y: 0 },
      data: { action: { tagSlugs: ["menu-agendamento"] } },
    },
    {
      tempId: "wf1-tag-agendou",
      type: "TAG",
      position: { x: 320, y: 0 },
      data: { action: { type: "ADD", tagSlugs: ["agendou"] } },
    },
    {
      tempId: "wf1-move-status",
      type: "MOVE_LEAD",
      position: { x: 640, y: 0 },
      data: { statusSlug: "em-agendamento" },
    },
    {
      tempId: "wf1-send-agenda",
      type: "SEND_AGENDA",
      position: { x: 960, y: 0 },
      data: {},
    },
  ];
  const headConns: ConnOut[] = [
    { fromTempId: "wf1-trigger", toTempId: "wf1-tag-agendou", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf1-tag-agendou", toTempId: "wf1-move-status", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf1-move-status", toTempId: "wf1-send-agenda", fromOutput: "main", toInput: "main" },
  ];

  const cadence = buildCadenceChain({
    prefix: "wf1",
    fromTempId: "wf1-send-agenda",
    engagedTagSlug: "ganho",
    exitTagSlug: "sem-interesse",
    messageTemplate: (day) => {
      const m: Record<number, string> = {
        1: "Oi {{lead.name}}, vi que ainda não confirmou o horário. Quer que eu te mande o link de novo?",
        2: "{{lead.name}}, segue o link da agenda — clique pra escolher o melhor horário.",
        3: "Ainda dá tempo de agendar essa semana, {{lead.name}}. Posso te ajudar a escolher um horário?",
        4: "{{lead.name}}, separei alguns horários extras pra você. Quer que eu te mande?",
        5: "Eita {{lead.name}}, vai uma semana já. Continua na ideia de agendar?",
        7: "Oi {{lead.name}}, queria saber se o agendamento ainda faz sentido pra você.",
        15: "{{lead.name}}, faz 15 dias. Se mudou algo aí, me avisa que ajusto.",
        20: "{{lead.name}}, vou reabrir o convite. Quer escolher uma data nova?",
        30: "Tá complicado, {{lead.name}}? Posso adaptar pra um horário que caiba na sua rotina.",
        90: "Oi {{lead.name}}! Última tentativa: se ainda quiser agendar, é só responder. Senão, vou pausar por aqui — sem stress.",
      };
      return m[day] ?? `Follow-up dia ${day}, {{lead.name}}.`;
    },
  });

  return {
    slug: "agendamento-menu",
    name: "Lead Agendamento (Menu)",
    description:
      "Lead escolheu Agendamento no menu — envia agenda, tenta reagendar e cadência 1/2/3/4/5/7/15/20/30/90 dias com saída antecipada por IA.",
    folderSlug: "core" as const,
    isActive: true,
    agentMode: true,
    nodes: [...head, ...cadence.nodes],
    connections: [...headConns, ...cadence.connections],
  };
};

const buildWorkflow2Produtos = () => {
  const head: NodeOut[] = [
    {
      tempId: "wf2-trigger",
      type: "LEAD_TAGGED",
      position: { x: 0, y: 0 },
      data: { action: { tagSlugs: ["menu-produtos"] } },
    },
    {
      tempId: "wf2-tag-orcamento",
      type: "TAG",
      position: { x: 320, y: 0 },
      data: { action: { type: "ADD", tagSlugs: ["pediu-orcamento"] } },
    },
    {
      tempId: "wf2-move-status",
      type: "MOVE_LEAD",
      position: { x: 640, y: 0 },
      data: { statusSlug: "em-negociacao" },
    },
    {
      tempId: "wf2-send-proposal",
      type: "SEND_PROPOSAL",
      position: { x: 960, y: 0 },
      data: {},
    },
    {
      tempId: "wf2-wait-accept",
      type: "WAIT_FOR_EVENT",
      position: { x: 1280, y: 0 },
      data: {
        preset: "lead-tagged",
        eventName: "agent-workflow/lead-tagged",
        timeoutMinutes: 60 * 24,
      },
    },
    {
      tempId: "wf2-decision-accept",
      type: "AI_DECISION",
      position: { x: 1600, y: 0 },
      data: {
        prompt:
          "Lead {{lead.name}} respondeu sobre a proposta. Aceitou (quer fechar/contrato), rejeitou (preço/tempo) ou ainda não decidiu?",
        branches: [
          { id: "aceitou", label: "Aceitou", description: "Disse sim/fechado" },
          {
            id: "rejeitou",
            label: "Rejeitou",
            description: "Não quer / sem orçamento",
          },
          {
            id: "indeciso",
            label: "Indeciso",
            description: "Vai pensar / pediu mais info",
          },
        ],
      },
    },
    {
      tempId: "wf2-tag-aceita",
      type: "TAG",
      position: { x: 1920, y: -100 },
      data: { action: { type: "ADD", tagSlugs: ["proposta-aceita"] } },
    },
    {
      tempId: "wf2-send-contract",
      type: "SEND_CONTRACT",
      position: { x: 2240, y: -100 },
      data: {},
    },
    {
      tempId: "wf2-tag-contrato",
      type: "TAG",
      position: { x: 2560, y: -100 },
      data: { action: { type: "ADD", tagSlugs: ["contrato-gerado"] } },
    },
  ];
  const headConns: ConnOut[] = [
    { fromTempId: "wf2-trigger", toTempId: "wf2-tag-orcamento", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf2-tag-orcamento", toTempId: "wf2-move-status", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf2-move-status", toTempId: "wf2-send-proposal", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf2-send-proposal", toTempId: "wf2-wait-accept", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf2-wait-accept", toTempId: "wf2-decision-accept", fromOutput: "main", toInput: "main" },
    {
      fromTempId: "wf2-decision-accept",
      toTempId: "wf2-tag-aceita",
      fromOutput: "aceitou",
      toInput: "target-1",
    },
    { fromTempId: "wf2-tag-aceita", toTempId: "wf2-send-contract", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf2-send-contract", toTempId: "wf2-tag-contrato", fromOutput: "main", toInput: "main" },
  ];

  const cadence = buildCadenceChain({
    prefix: "wf2",
    fromTempId: "wf2-decision-accept",
    engagedTagSlug: "ganho",
    exitTagSlug: "sem-interesse",
    messageTemplate: (day) => {
      const m: Record<number, string> = {
        1: "Oi {{lead.name}}, viu a proposta? Alguma dúvida ou ajuste de preço pra fechar?",
        2: "{{lead.name}}, vou deixar a proposta aberta. Quer ajustar valor ou condição?",
        3: "Tem alguma dúvida sobre a proposta, {{lead.name}}? Posso explicar item por item.",
        4: "{{lead.name}}, consigo fazer uma condição especial se fechar essa semana. Topa?",
        5: "Já faz 5 dias, {{lead.name}}. A proposta ainda serve ou seu cenário mudou?",
        7: "Oi {{lead.name}}, quer que eu te mande uma alternativa mais enxuta?",
        15: "{{lead.name}}, vou reabrir a conversa. Continua interessado nessa solução?",
        20: "Posso te oferecer uma condição diferente, {{lead.name}}. Quer reaver?",
        30: "{{lead.name}}, faz um mês. Se o orçamento mudou, me fala que reajusto.",
        90: "Última tentativa, {{lead.name}}! Se quiser retomar, é só responder. Vou arquivar por aqui.",
      };
      return m[day] ?? `Follow-up dia ${day}.`;
    },
  });

  // Ramo "rejeitou" do AI_DECISION inicial → direto pra sem-interesse
  const directExit: ConnOut[] = [
    {
      fromTempId: "wf2-decision-accept",
      toTempId: cadence.lastTempId,
      fromOutput: "rejeitou",
      toInput: "target-1",
    },
  ];

  return {
    slug: "produtos-menu",
    name: "Lead Produtos (Menu)",
    description:
      "Lead escolheu Produtos — envia proposta, aceita → contrato; senão cadência 1/2/3/4/5/7/15/20/30/90 com saída antecipada por IA.",
    folderSlug: "core" as const,
    isActive: true,
    agentMode: true,
    nodes: [...head, ...cadence.nodes],
    connections: [...headConns, ...directExit, ...cadence.connections],
  };
};

const buildWorkflow3Interesse = () => {
  const head: NodeOut[] = [
    {
      tempId: "wf3-trigger",
      type: "LEAD_TAGGED",
      position: { x: 0, y: 0 },
      data: { action: { tagSlugs: ["menu-interesse"] } },
    },
    {
      tempId: "wf3-tag-interessado",
      type: "TAG",
      position: { x: 320, y: 0 },
      data: { action: { type: "ADD", tagSlugs: ["interessado"] } },
    },
    {
      tempId: "wf3-move-status",
      type: "MOVE_LEAD",
      position: { x: 640, y: 0 },
      data: { statusSlug: "engajado" },
    },
    {
      tempId: "wf3-send-welcome",
      type: "SEND_MESSAGE",
      position: { x: 960, y: 0 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Oi {{lead.name}}! Vi que se interessou. Me conta um pouco do que você procura pra eu te indicar a melhor opção?",
          },
        },
      },
    },
  ];
  const headConns: ConnOut[] = [
    { fromTempId: "wf3-trigger", toTempId: "wf3-tag-interessado", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf3-tag-interessado", toTempId: "wf3-move-status", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf3-move-status", toTempId: "wf3-send-welcome", fromOutput: "main", toInput: "main" },
  ];

  const cadence = buildCadenceChain({
    prefix: "wf3",
    fromTempId: "wf3-send-welcome",
    engagedTagSlug: "ganho",
    exitTagSlug: "sem-interesse",
    messageTemplate: (day) => {
      const m: Record<number, string> = {
        1: "Oi {{lead.name}}, voltou pra dar uma olhada? Posso te mostrar opções parecidas com o que você curtiu.",
        2: "{{lead.name}}, separei umas sugestões. Quer ver?",
        3: "Apareceu algo novo no nosso catálogo, {{lead.name}}. Quer dar uma olhada?",
        4: "Oi {{lead.name}}, vi que você ficou de olho aquele item. Posso te enviar mais detalhes.",
        5: "{{lead.name}}, vamos retomar? Aqueles itens que você viu ainda estão disponíveis.",
        7: "Quer uma indicação personalizada, {{lead.name}}? Me conta o que mudou no seu interesse.",
        15: "{{lead.name}}, separei uma condição especial pra te conquistar de volta.",
        20: "Tô com saudade da nossa conversa, {{lead.name}}! Vamos ver opções novas?",
        30: "{{lead.name}}, tem algo que eu possa fazer pra reaver seu interesse?",
        90: "Última tentativa, {{lead.name}}! Se quiser voltar a olhar, me chama. Senão, paro por aqui.",
      };
      return m[day] ?? `Reconquista dia ${day}.`;
    },
  });

  return {
    slug: "interesse-menu",
    name: "Lead Interesse no Menu",
    description:
      "Lead se interessou por item do menu — tenta recompra/reconquista + cadência 1/2/3/4/5/7/15/20/30/90 com saída antecipada por IA.",
    folderSlug: "core" as const,
    isActive: true,
    agentMode: true,
    nodes: [...head, ...cadence.nodes],
    connections: [...headConns, ...cadence.connections],
  };
};

const buildWorkflow4Comprovante = () => {
  const head: NodeOut[] = [
    {
      tempId: "wf4-trigger",
      type: "LEAD_TAGGED",
      position: { x: 0, y: 0 },
      data: { action: { tagSlugs: ["menu-compra"] } },
    },
    {
      tempId: "wf4-tag-aguarda",
      type: "TAG",
      position: { x: 320, y: 0 },
      data: { action: { type: "ADD", tagSlugs: ["aguarda-comprovante"] } },
    },
    {
      tempId: "wf4-move-status",
      type: "MOVE_LEAD",
      position: { x: 640, y: 0 },
      data: { statusSlug: "em-cobranca" },
    },
    {
      tempId: "wf4-ask-receipt",
      type: "SEND_MESSAGE",
      position: { x: 960, y: 0 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Combinado {{lead.name}}! Quando fizer o pagamento, é só me mandar o comprovante (PIX/boleto) aqui mesmo que eu confirmo na hora.",
          },
        },
      },
    },
    {
      tempId: "wf4-wait-msg",
      type: "WAIT_FOR_EVENT",
      position: { x: 1280, y: 0 },
      data: {
        preset: "message-incoming",
        eventName: "agent-workflow/message-incoming",
        timeoutMinutes: 60 * 24,
      },
    },
    {
      tempId: "wf4-ai-vision",
      type: "AI_VISION",
      position: { x: 1600, y: 0 },
      data: {
        prompt:
          "O lead enviou uma imagem. Isso é um comprovante de pagamento válido " +
          "(PIX, transferência, boleto pago)? Se for, qual o valor e a data?",
      },
    },
    {
      tempId: "wf4-decision-paid",
      type: "AI_DECISION",
      position: { x: 1920, y: 0 },
      data: {
        prompt:
          "Olhe a análise da IA Vision. O comprovante é válido e o pagamento " +
          "foi confirmado?",
        branches: [
          {
            id: "pago",
            label: "Pago",
            description: "Comprovante válido e confirmado",
          },
          {
            id: "nao_pago",
            label: "Não pago / inválido",
            description: "Comprovante inválido, fake ou ausente",
          },
        ],
      },
    },
    {
      tempId: "wf4-tag-pago",
      type: "TAG",
      position: { x: 2240, y: -80 },
      data: { action: { type: "ADD", tagSlugs: ["pagamento-confirmado"] } },
    },
    {
      tempId: "wf4-move-fechado",
      type: "MOVE_LEAD",
      position: { x: 2560, y: -80 },
      data: { statusSlug: "fechado" },
    },
    {
      tempId: "wf4-thanks",
      type: "SEND_MESSAGE",
      position: { x: 2880, y: -80 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Comprovante confirmado, {{lead.name}}! Obrigada — qualquer coisa, é só chamar.",
          },
        },
      },
    },
  ];
  const headConns: ConnOut[] = [
    { fromTempId: "wf4-trigger", toTempId: "wf4-tag-aguarda", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf4-tag-aguarda", toTempId: "wf4-move-status", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf4-move-status", toTempId: "wf4-ask-receipt", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf4-ask-receipt", toTempId: "wf4-wait-msg", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf4-wait-msg", toTempId: "wf4-ai-vision", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf4-ai-vision", toTempId: "wf4-decision-paid", fromOutput: "main", toInput: "main" },
    {
      fromTempId: "wf4-decision-paid",
      toTempId: "wf4-tag-pago",
      fromOutput: "pago",
      toInput: "target-1",
    },
    { fromTempId: "wf4-tag-pago", toTempId: "wf4-move-fechado", fromOutput: "main", toInput: "main" },
    { fromTempId: "wf4-move-fechado", toTempId: "wf4-thanks", fromOutput: "main", toInput: "main" },
  ];

  const cadence = buildCadenceChain({
    prefix: "wf4",
    fromTempId: "wf4-decision-paid",
    engagedTagSlug: "pagamento-confirmado",
    exitTagSlug: "sem-interesse",
    messageTemplate: (day) => {
      const m: Record<number, string> = {
        1: "Oi {{lead.name}}, ainda não chegou o comprovante. Tudo certo aí?",
        2: "{{lead.name}}, vou aguardar mais um pouco. Posso te enviar a chave de novo?",
        3: "Precisa de ajuda com o pagamento, {{lead.name}}? Tem outras opções (boleto, cartão).",
        4: "{{lead.name}}, ainda dá tempo de pagar essa semana com a condição combinada.",
        5: "Tem alguma dificuldade com o pagamento, {{lead.name}}? Me diga que eu ajusto.",
        7: "Oi {{lead.name}}, vou liberar mais 7 dias. Me avise se topar essa condição.",
        15: "{{lead.name}}, posso parcelar pra você. Quer reabrir a conversa?",
        20: "Sem cobrança {{lead.name}}, só queria saber se ainda quer fechar.",
        30: "{{lead.name}}, faz 30 dias. Posso te oferecer uma 2ª via com condições diferentes.",
        90: "Última chamada, {{lead.name}}! Se quiser reabrir, é só responder. Vou pausar por aqui.",
      };
      return m[day] ?? `Cobrança dia ${day}.`;
    },
  });

  // Ramo "nao_pago" do decision → mensagem de revisão + cadência cobrança
  const reviewConn: ConnOut[] = [
    {
      fromTempId: "wf4-decision-paid",
      toTempId: cadence.nodes[0]?.tempId ?? cadence.lastTempId,
      fromOutput: "nao_pago",
      toInput: "target-1",
    },
  ];

  return {
    slug: "compra-comprovante-menu",
    name: "Lead Compra + Comprovante (Menu)",
    description:
      "Lead escolheu Compra — pede comprovante, IA Vision identifica pagamento, confirma ou cadência cobrança 1/2/3/4/5/7/15/20/30/90.",
    folderSlug: "core" as const,
    isActive: true,
    agentMode: true,
    nodes: [...head, ...cadence.nodes],
    connections: [...headConns, ...reviewConn, ...cadence.connections],
  };
};

export const comercialMenuInterativoSpec: PresetSpec = {
  tracking: {
    name: "Comercial — Menu Interativo",
    description:
      "Pipeline completo focado em leads que entram via menu interativo do WhatsApp. 4 jornadas (agendamento, produtos, interesse, compra com comprovante) com cadência de follow-up unificada (1/2/3/4/5/7/15/20/30/90 dias) e saída antecipada por IA. Tags e status padronizados pra produção.",
    ai: {
      assistantName: "Comercial Bot",
      prompt:
        "Você é o assistente comercial do menu interativo. Apresente o menu (agendamento, produtos, interesse, compra), interprete a escolha do lead e aplique a tag correspondente (menu-agendamento, menu-produtos, menu-interesse ou menu-compra). Tom consultivo, perguntas curtas, sem pressão.",
      finishSentence:
        "Quando o lead escolher uma opção do menu e a tag correspondente for aplicada, ou quando pedir explicitamente um humano",
    },
  },
  status: [
    { slug: "novo", name: "Novo", color: "#FF6B6B", order: 0 },
    { slug: "engajado", name: "Engajado", color: "#FFA500", order: 1 },
    { slug: "em-agendamento", name: "Em Agendamento", color: "#9C27B0", order: 2 },
    { slug: "em-negociacao", name: "Em Negociação", color: "#7A5FDF", order: 3 },
    { slug: "em-cobranca", name: "Em Cobrança", color: "#FFD700", order: 4 },
    { slug: "fechado", name: "Fechado", color: "#3DB88B", order: 5 },
    { slug: "perdido", name: "Perdido", color: "#888888", order: 6 },
  ],
  winLossReasons: [
    { name: "Engajou no follow-up", type: "WIN" },
    { name: "Comprovante confirmado", type: "WIN" },
    { name: "Contrato fechado", type: "WIN" },
    { name: "Sem interesse confirmado", type: "LOSS" },
    { name: "Não respondeu cadência", type: "LOSS" },
    { name: "Rejeitou proposta", type: "LOSS" },
  ],
  tagGroups: [
    { slug: "menu", name: "Entrada do Menu", color: "#4ECDC4" },
    { slug: "estagio", name: "Estágio Comercial", color: "#7A5FDF" },
    { slug: "cadencia", name: "Cadência de Follow-up", color: "#FFA500" },
    { slug: "saida", name: "Resultado", color: "#3DB88B" },
  ],
  tags: [
    // Origem (menu)
    { slug: "menu-agendamento", name: "Menu: Agendamento", color: "#9C27B0", groupSlug: "menu" },
    { slug: "menu-produtos", name: "Menu: Produtos", color: "#7A5FDF", groupSlug: "menu" },
    { slug: "menu-interesse", name: "Menu: Interesse", color: "#1090E0", groupSlug: "menu" },
    { slug: "menu-compra", name: "Menu: Compra", color: "#FFD700", groupSlug: "menu" },
    // Estágio comercial
    { slug: "agendou", name: "Agendou", color: "#9C27B0", groupSlug: "estagio" },
    { slug: "pediu-orcamento", name: "Pediu Orçamento", color: "#FFA500", groupSlug: "estagio" },
    { slug: "proposta-aceita", name: "Proposta Aceita", color: "#3DB88B", groupSlug: "estagio" },
    { slug: "contrato-gerado", name: "Contrato Gerado", color: "#1090E0", groupSlug: "estagio" },
    { slug: "interessado", name: "Interessado", color: "#FFA500", groupSlug: "estagio" },
    { slug: "aguarda-comprovante", name: "Aguarda Comprovante", color: "#FFD700", groupSlug: "estagio" },
    { slug: "pagamento-confirmado", name: "Pagamento Confirmado", color: "#3DB88B", groupSlug: "estagio" },
    // Cadência (1/2/3/4/5/7/15/20/30/90)
    { slug: "follow-1", name: "Follow-up D+1", color: "#FFA500", groupSlug: "cadencia" },
    { slug: "follow-2", name: "Follow-up D+2", color: "#FFA500", groupSlug: "cadencia" },
    { slug: "follow-3", name: "Follow-up D+3", color: "#FFA500", groupSlug: "cadencia" },
    { slug: "follow-4", name: "Follow-up D+4", color: "#FFA500", groupSlug: "cadencia" },
    { slug: "follow-5", name: "Follow-up D+5", color: "#FFA500", groupSlug: "cadencia" },
    { slug: "follow-7", name: "Follow-up D+7", color: "#FF6B6B", groupSlug: "cadencia" },
    { slug: "follow-15", name: "Follow-up D+15", color: "#FF6B6B", groupSlug: "cadencia" },
    { slug: "follow-20", name: "Follow-up D+20", color: "#FF6B6B", groupSlug: "cadencia" },
    { slug: "follow-30", name: "Follow-up D+30", color: "#FF6B6B", groupSlug: "cadencia" },
    { slug: "follow-90", name: "Follow-up D+90", color: "#888888", groupSlug: "cadencia" },
    // Saída
    { slug: "ganho", name: "Ganho", color: "#3DB88B", groupSlug: "saida" },
    { slug: "sem-interesse", name: "Sem interesse", color: "#888888", groupSlug: "saida" },
  ],
  workflowFolders: [
    { slug: "core", name: "Automações Ativas", order: 0 },
    { slug: "biblioteca", name: "Padrões Extras (inativos)", order: 1 },
  ],
  workflows: [
    buildWorkflow1Agendamento(),
    buildWorkflow2Produtos(),
    buildWorkflow3Interesse(),
    buildWorkflow4Comprovante(),
  ],
};
