/**
 * Preset visual completo do Modo Agente IA — "Closer Comercial com Follow-up".
 *
 * Reproduz o pedido:
 *   "Quando o lead entrar e escolher a 'opção X' no chat, adicione a tag
 *   'opção X' e envie a proposta comercial com produto X. Fique tentando
 *   com mensagens diferentes (sempre chamando o nome do lead) por 1, 3, 5,
 *   7 dias até que ele mostre interesse no produto ou aceite a proposta.
 *   Após isso insira a tag 'Aprovado', envie a 'Mensagem X' e envie o
 *   lead para o 'Tracking Y'."
 *
 * Estrutura do grafo (multi-trigger + loop com IA decisora):
 *
 *   NEW_LEAD ─┐
 *             ├→ SEND_MESSAGE (menu de opções) → WAIT_FOR_EVENT (resposta)
 *             │      → AI_DECISION ("qual opção?")
 *             │         ├ "option_x" → TAG (Opção X)
 *             │         │              → SEND_PROPOSAL (Produto X)
 *             │         │              → SET_VARIABLE { followupDays:[1,3,5,7] }
 *             │         │              → LOOP_OVER (4 tentativas)
 *             │         │                  ┌── loop ─→ WAIT (n dias)
 *             │         │                  │           → AI_GENERATE_TEXT (chama nome)
 *             │         │                  │           → SEND_MESSAGE
 *             │         │                  │           → WAIT_FOR_EVENT (resposta, 24h)
 *             │         │                  │           → AI_DECISION (interesse?)
 *             │         │                  │              ├ "accepted"  ┐
 *             │         │                  │              ├ "interested"┤
 *             │         │                  │              └ "no" → volta pro LOOP_OVER
 *             │         │                  └── done ─────────────────────┤
 *             │         │                                                ↓
 *             │         │                                              MERGE
 *             │         │                                                ↓
 *             │         │                                          TAG (Aprovado)
 *             │         │                                                ↓
 *             │         │                                       SEND_MESSAGE (mensagem X)
 *             │         │                                                ↓
 *             │         │                                          MOVE_LEAD (Tracking Y)
 *             │         └ "outras" → SEND_MESSAGE (fallback) → (fim)
 *             │
 *   MESSAGE_INCOMING ─┘  (entra no mesmo AI_DECISION quando lead responde fora de WAIT)
 *
 * Como aplicar:
 *   - Via script: `pnpm tsx scripts/seed-closer-preset.ts <trackingId>`
 *     (não incluído — chame `seedCloserComFollowup` direto do seu próprio script)
 *   - Via oRPC: chame `seedCloserComFollowup` num handler temporário
 *   - Via Prisma Studio: copie o JSON `CLOSER_COM_FOLLOWUP_BLUEPRINT` e cole
 *     manualmente em Workflow + Node + Connection
 *
 * Placeholders a substituir antes de ativar (marcados como `<<...>>`):
 *   <<PRODUTO_X_ID>>     ID do produto pra SEND_PROPOSAL
 *   <<RESPONSAVEL_ID>>   User responsável pela proposta
 *   <<TAG_OPCAO_X_ID>>   ID da tag "Opção X"
 *   <<TAG_APROVADO_ID>>  ID da tag "Aprovado"
 *   <<TRACKING_Y_ID>>    Tracking de destino
 *   <<STATUS_DESTINO_ID>> Status inicial no Tracking Y
 *   <<MENU_TEXT>>        Texto do menu inicial
 *   <<MSG_APROVADO>>     Texto da mensagem final pós-aprovação
 *   <<MSG_FALLBACK>>     Texto pra leads que escolheram outra opção
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { NodeType } from "@/generated/prisma/enums";
import { createId } from "@paralleldrive/cuid2";

/**
 * Parâmetros pra customizar a aplicação do preset (IDs reais da org).
 * Todos os campos opcionais usam placeholder string se não fornecidos —
 * o user precisa editar depois pelo canvas pra deixar funcional.
 */
export interface SeedCloserComFollowupParams {
  organizationId: string;
  trackingId: string;
  userId?: string | null;
  /** Nome customizado do workflow (default: "Closer Comercial — Opção X com Follow-up") */
  name?: string;
  /** Produto pra SEND_PROPOSAL */
  produtoXId?: string;
  /** Responsável da proposta (User.id) */
  responsavelId?: string;
  /** Tag "Opção X" (Tag.id) */
  tagOpcaoXId?: string;
  /** Tag "Aprovado" (Tag.id) */
  tagAprovadoId?: string;
  /** Tracking de destino pra MOVE_LEAD */
  trackingDestinoId?: string;
  /** Status inicial no tracking de destino */
  statusDestinoId?: string;
  /** Texto do menu inicial */
  menuText?: string;
  /** Texto da mensagem final pós-aprovação */
  msgAprovado?: string;
  /** Texto fallback pra outras opções */
  msgFallback?: string;
  /** Schedule customizado de follow-up (default [1,3,5,7] dias) */
  followupDays?: number[];
}

/**
 * Blueprint declarativo do grafo. Tipos seguem a estrutura usada nos
 * canvas (@xyflow/react) + a tabela Prisma `Node` + `Connection`.
 *
 * Estrutura: { nodes: [...], edges: [...] } com posição XY já alinhada
 * pra ficar visualmente legível no canvas.
 */
export function buildCloserComFollowupBlueprint(
  params: SeedCloserComFollowupParams,
) {
  const days = params.followupDays ?? [1, 3, 5, 7];
  const menuText =
    params.menuText ??
    "Olá {{lead.name}}! Em qual opção você tem interesse?\n\n1) Opção X (Produto X)\n2) Opção Y (outro produto)\n3) Outras dúvidas";

  // IDs estáveis dentro do workflow — usamos prefixos por seção pra ficar
  // fácil de seguir o grafo na hora de debugar.
  const ids = {
    triggerNewLead: "trg-new-lead",
    triggerMessageIncoming: "trg-msg-in",
    sendMenuMsg: "act-send-menu",
    waitMenuReply: "ctl-wait-menu",
    decideOption: "ai-decide-option",
    // Branch "Opção X"
    tagOpcaoX: "act-tag-opcao-x",
    sendProposalX: "act-send-prop-x",
    setFollowupVars: "act-set-vars",
    loopFollowup: "ctl-loop-followup",
    waitDay: "ctl-wait-day",
    aiGenText: "ai-gen-text",
    sendFollowupMsg: "act-send-followup",
    waitLeadReply: "ctl-wait-lead",
    decideInterest: "ai-decide-interest",
    // Caminho de conversão
    mergeConversion: "ctl-merge-conv",
    tagAprovado: "act-tag-aprovado",
    sendMsgAprovado: "act-send-aprovado",
    moveLeadDestino: "act-move-lead",
    // Branch "outras"
    sendFallback: "act-send-fallback",
  } as const;

  const nodes: Array<{
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }> = [
    // ─── Triggers (multi-trigger só funciona com agentMode=true) ──────────
    {
      id: ids.triggerNewLead,
      type: NodeType.NEW_LEAD,
      position: { x: 0, y: 0 },
      data: {},
    },
    {
      id: ids.triggerMessageIncoming,
      type: NodeType.MESSAGE_INCOMING,
      position: { x: 0, y: 120 },
      data: {},
    },

    // ─── Etapa 1: envia menu + espera resposta ────────────────────────────
    {
      id: ids.sendMenuMsg,
      type: NodeType.SEND_MESSAGE,
      position: { x: 280, y: 60 },
      data: {
        action: {
          payload: { type: "TEXT", message: menuText },
        },
      },
    },
    {
      id: ids.waitMenuReply,
      type: NodeType.WAIT_FOR_EVENT,
      position: { x: 560, y: 60 },
      data: {
        eventName: "message-incoming",
        timeoutMinutes: 60 * 24, // 24h pra responder
      },
    },

    // ─── Etapa 2: IA decide qual opção foi escolhida ──────────────────────
    {
      id: ids.decideOption,
      type: NodeType.AI_DECISION,
      position: { x: 840, y: 60 },
      data: {
        organizationId: params.organizationId,
        prompt:
          "Analise a última mensagem do lead em {{lead}} e identifique qual opção ele escolheu. Considere variações de escrita.",
        branches: [
          {
            id: "option_x",
            label: "Lead escolheu Opção X",
            description: "Mencionou produto X, opção 1, ou semelhante",
          },
          {
            id: "outras",
            label: "Outras opções ou indefinido",
            description: "Qualquer resposta fora de Opção X",
          },
        ],
      },
    },

    // ─── Branch "Opção X": adiciona tag + envia proposta ──────────────────
    {
      id: ids.tagOpcaoX,
      type: NodeType.TAG,
      position: { x: 1120, y: -60 },
      data: {
        action: {
          type: "ADD",
          tagsIds: [params.tagOpcaoXId ?? "<<TAG_OPCAO_X_ID>>"],
        },
      },
    },
    {
      id: ids.sendProposalX,
      type: NodeType.SEND_PROPOSAL,
      position: { x: 1400, y: -60 },
      data: {
        action: {
          productIds: [params.produtoXId ?? "<<PRODUTO_X_ID>>"],
          responsibleId: params.responsavelId ?? "<<RESPONSAVEL_ID>>",
          validityDays: 7,
        },
      },
    },

    // ─── Etapa 3: prepara o loop ──────────────────────────────────────────
    {
      id: ids.setFollowupVars,
      type: NodeType.SET_VARIABLE,
      position: { x: 1680, y: -60 },
      data: {
        name: "followupDays",
        value: days,
      },
    },
    {
      id: ids.loopFollowup,
      type: NodeType.LOOP_OVER,
      position: { x: 1960, y: -60 },
      data: {
        arrayPath: "vars.followupDays",
        maxIterations: days.length,
      },
    },

    // ─── Loop: espera N dias → IA gera msg → envia → espera resposta ──────
    {
      id: ids.waitDay,
      type: NodeType.WAIT,
      position: { x: 1960, y: 200 },
      data: {
        action: {
          type: "days",
          // O número real vem do `loopItem` na execução — esse campo é só
          // um fallback estático pro caso do user rodar fora do loop.
          days: 1,
        },
      },
    },
    {
      id: ids.aiGenText,
      type: NodeType.AI_GENERATE_TEXT,
      position: { x: 2240, y: 200 },
      data: {
        organizationId: params.organizationId,
        tone: "amigável e consultivo",
        prompt:
          "Tentativa #{{vars.loopIndex}} de follow-up. O lead {{lead.name}} ainda não respondeu sobre a proposta do produto X. Gere uma mensagem CURTA (max 2 parágrafos), em pt-BR, sempre chamando ele pelo nome, com uma abordagem diferente das mensagens anteriores: ângulo de urgência, prova social, ou pergunta aberta. Termine com 1 CTA.",
        maxTokens: 240,
      },
    },
    {
      id: ids.sendFollowupMsg,
      type: NodeType.SEND_MESSAGE,
      position: { x: 2520, y: 200 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            // O texto é interpolado a partir do output do AI_GENERATE_TEXT
            // (que escreve em vars.lastGeneratedText).
            message: "{{vars.lastGeneratedText}}",
          },
        },
      },
    },
    {
      id: ids.waitLeadReply,
      type: NodeType.WAIT_FOR_EVENT,
      position: { x: 2800, y: 200 },
      data: {
        eventName: "message-incoming",
        timeoutMinutes: 60 * 24, // 24h pra responder
      },
    },
    {
      id: ids.decideInterest,
      type: NodeType.AI_DECISION,
      position: { x: 3080, y: 200 },
      data: {
        organizationId: params.organizationId,
        prompt:
          "Analise a última mensagem de {{lead.name}}. Ele mostrou interesse no produto X, aceitou a proposta, recusou explicitamente, ou não respondeu?",
        branches: [
          {
            id: "accepted",
            label: "Lead aceitou a proposta",
            description: 'Disse "aceito", "fechado", "quero", "sim", etc.',
          },
          {
            id: "interested",
            label: "Mostrou interesse",
            description: "Fez perguntas, pediu mais detalhes, demonstrou curiosidade",
          },
          {
            id: "no",
            label: "Sem resposta ou recusou",
            description: "Não respondeu, ignorou, ou disse 'depois'/'não'",
          },
        ],
      },
    },

    // ─── Caminho de conversão (MERGE de accepted + interested + LOOP done) ─
    {
      id: ids.mergeConversion,
      type: NodeType.MERGE,
      position: { x: 3360, y: -60 },
      data: {},
    },
    {
      id: ids.tagAprovado,
      type: NodeType.TAG,
      position: { x: 3640, y: -60 },
      data: {
        action: {
          type: "ADD",
          tagsIds: [params.tagAprovadoId ?? "<<TAG_APROVADO_ID>>"],
        },
      },
    },
    {
      id: ids.sendMsgAprovado,
      type: NodeType.SEND_MESSAGE,
      position: { x: 3920, y: -60 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              params.msgAprovado ??
              "Maravilha, {{lead.name}}! Sua proposta foi aprovada. Seguimos com os próximos passos por aqui.",
          },
        },
      },
    },
    {
      id: ids.moveLeadDestino,
      type: NodeType.MOVE_LEAD,
      position: { x: 4200, y: -60 },
      data: {
        action: {
          trackingId: params.trackingDestinoId ?? "<<TRACKING_Y_ID>>",
          statusId: params.statusDestinoId ?? "<<STATUS_DESTINO_ID>>",
        },
      },
    },

    // ─── Branch "outras opções": só envia fallback e encerra ──────────────
    {
      id: ids.sendFallback,
      type: NodeType.SEND_MESSAGE,
      position: { x: 1120, y: 200 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              params.msgFallback ??
              "Sem problema, {{lead.name}}! Um consultor humano vai te chamar pra entender melhor.",
          },
        },
      },
    },
  ];

  // ─── Conexões (Connection.fromOutput é semântico em IF/SWITCH/LOOP) ─────
  const edges: Array<{
    id: string;
    fromNodeId: string;
    toNodeId: string;
    fromOutput: string;
    toInput: string;
  }> = [
    // Triggers convergem em SEND_MESSAGE
    {
      id: "e-trg1-menu",
      fromNodeId: ids.triggerNewLead,
      toNodeId: ids.sendMenuMsg,
      fromOutput: "main",
      toInput: "main",
    },
    {
      id: "e-trg2-menu",
      fromNodeId: ids.triggerMessageIncoming,
      toNodeId: ids.decideOption,
      fromOutput: "main",
      toInput: "main",
    },
    {
      id: "e-menu-wait",
      fromNodeId: ids.sendMenuMsg,
      toNodeId: ids.waitMenuReply,
      fromOutput: "main",
      toInput: "main",
    },
    {
      id: "e-wait-decide",
      fromNodeId: ids.waitMenuReply,
      toNodeId: ids.decideOption,
      fromOutput: "main",
      toInput: "main",
    },

    // Branches da decisão da opção
    {
      id: "e-dec-opx",
      fromNodeId: ids.decideOption,
      toNodeId: ids.tagOpcaoX,
      fromOutput: "option_x",
      toInput: "main",
    },
    {
      id: "e-dec-outras",
      fromNodeId: ids.decideOption,
      toNodeId: ids.sendFallback,
      fromOutput: "outras",
      toInput: "main",
    },

    // Branch "Opção X" — sequência até o loop
    {
      id: "e-tag-prop",
      fromNodeId: ids.tagOpcaoX,
      toNodeId: ids.sendProposalX,
      fromOutput: "main",
      toInput: "main",
    },
    {
      id: "e-prop-vars",
      fromNodeId: ids.sendProposalX,
      toNodeId: ids.setFollowupVars,
      fromOutput: "main",
      toInput: "main",
    },
    {
      id: "e-vars-loop",
      fromNodeId: ids.setFollowupVars,
      toNodeId: ids.loopFollowup,
      fromOutput: "main",
      toInput: "main",
    },

    // LOOP_OVER tem 2 outputs: "loop" (cada iteração) e "done" (acabou)
    {
      id: "e-loop-wait",
      fromNodeId: ids.loopFollowup,
      toNodeId: ids.waitDay,
      fromOutput: "loop",
      toInput: "main",
    },
    {
      id: "e-wait-gen",
      fromNodeId: ids.waitDay,
      toNodeId: ids.aiGenText,
      fromOutput: "main",
      toInput: "main",
    },
    {
      id: "e-gen-send",
      fromNodeId: ids.aiGenText,
      toNodeId: ids.sendFollowupMsg,
      fromOutput: "main",
      toInput: "main",
    },
    {
      id: "e-send-waitlead",
      fromNodeId: ids.sendFollowupMsg,
      toNodeId: ids.waitLeadReply,
      fromOutput: "main",
      toInput: "main",
    },
    {
      id: "e-waitlead-decide",
      fromNodeId: ids.waitLeadReply,
      toNodeId: ids.decideInterest,
      fromOutput: "main",
      toInput: "main",
    },

    // Decisão de interesse → 3 branches
    {
      id: "e-dec-accepted",
      fromNodeId: ids.decideInterest,
      toNodeId: ids.mergeConversion,
      fromOutput: "accepted",
      toInput: "main",
    },
    {
      id: "e-dec-interested",
      fromNodeId: ids.decideInterest,
      toNodeId: ids.mergeConversion,
      fromOutput: "interested",
      toInput: "main",
    },
    // "no" volta pro LOOP_OVER — esse é o ciclo permitido (cycle-detector
    // aceita porque tem AI_DECISION como nó de controle no caminho)
    {
      id: "e-dec-no",
      fromNodeId: ids.decideInterest,
      toNodeId: ids.loopFollowup,
      fromOutput: "no",
      toInput: "main",
    },

    // LOOP_OVER "done" → conversão (também marca como aprovado mesmo se
    // não chegou aceite, pois esgotamos as tentativas — ajustar pra outro
    // path se preferir marcar como "perdido" em vez disso)
    {
      id: "e-loop-done",
      fromNodeId: ids.loopFollowup,
      toNodeId: ids.mergeConversion,
      fromOutput: "done",
      toInput: "main",
    },

    // Pós-MERGE → caminho final de conversão
    {
      id: "e-merge-tag",
      fromNodeId: ids.mergeConversion,
      toNodeId: ids.tagAprovado,
      fromOutput: "main",
      toInput: "main",
    },
    {
      id: "e-tag-msg",
      fromNodeId: ids.tagAprovado,
      toNodeId: ids.sendMsgAprovado,
      fromOutput: "main",
      toInput: "main",
    },
    {
      id: "e-msg-move",
      fromNodeId: ids.sendMsgAprovado,
      toNodeId: ids.moveLeadDestino,
      fromOutput: "main",
      toInput: "main",
    },
  ];

  return { nodes, edges, name: params.name ?? "Closer Comercial — Opção X com Follow-up" };
}

/**
 * Aplica o blueprint criando o Workflow + Nodes + Connections via Prisma.
 *
 * Retorna o `workflowId` criado pra que o caller possa abrir o canvas
 * direto no editor (`/tracking/<trackingId>/workflows/<workflowId>`).
 *
 * Importante: `agentMode = true` é obrigatório — o blueprint usa
 * multi-trigger, branches, LOOP_OVER e nós de IA que só funcionam
 * no engine novo (run-workflow.ts).
 */
export async function seedCloserComFollowup(
  prisma: PrismaClient,
  params: SeedCloserComFollowupParams,
) {
  const blueprint = buildCloserComFollowupBlueprint(params);

  return prisma.$transaction(async (tx) => {
    const workflow = await tx.workflow.create({
      data: {
        id: createId(),
        name: blueprint.name,
        description:
          "Preset gerado pelo Modo Agente IA: qualifica opção, envia proposta, faz follow-up com IA por 1/3/5/7 dias e converte quando aceito.",
        userId: params.userId ?? null,
        trackingId: params.trackingId,
        agentMode: true,
        maxRunsPerHour: 60,
        // isActive=false por default — user revisa placeholders antes
        // de ativar manualmente no canvas.
        isActive: false,
      },
    });

    // Map dos IDs declarativos do blueprint → IDs reais (cuid) no DB.
    // Importante porque os Connection.fromNodeId/toNodeId precisam dos
    // mesmos IDs do Node.id criado.
    const idMap = new Map<string, string>();
    for (const n of blueprint.nodes) {
      const realId = createId();
      idMap.set(n.id, realId);
      await tx.node.create({
        data: {
          id: realId,
          workflowId: workflow.id,
          name: n.type,
          type: n.type,
          position: n.position,
          data: n.data,
        },
      });
    }

    for (const e of blueprint.edges) {
      await tx.connection.create({
        data: {
          id: createId(),
          workflowId: workflow.id,
          fromNodeId: idMap.get(e.fromNodeId)!,
          toNodeId: idMap.get(e.toNodeId)!,
          fromOutput: e.fromOutput,
          toInput: e.toInput,
        },
      });
    }

    return {
      workflowId: workflow.id,
      nodeCount: blueprint.nodes.length,
      edgeCount: blueprint.edges.length,
    };
  });
}
