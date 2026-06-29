/**
 * Preset "Agente de Agendamento" — pra um lead novo, faz qualificação leve
 * via IA, decide se o lead quer agendar, envia link de agenda, espera o
 * agendamento ser confirmado, agradece.
 *
 *  NEW_LEAD ─→ AI_GENERATE_TEXT (saudação personalizada)
 *           → SEND_MESSAGE
 *           → WAIT_FOR_EVENT (resposta, 24h)
 *           → AI_DECISION ("quer agendar?")
 *               ├ "yes"  → SEND_AGENDA (placeholder agenda)
 *               │         → WAIT_FOR_EVENT (agenda confirmada, 48h)
 *               │         → AI_GENERATE_TEXT (mensagem de boas-vindas)
 *               │         → SEND_MESSAGE
 *               │         → TAG (placeholder "Agendado")
 *               └ "no"   → TAG (placeholder "Sem interesse")
 *
 * Placeholders <<...>> precisam ser substituídos no canvas pelo operador
 * antes de ativar:
 *   <<AGENDA_ID>>          ID da agenda real
 *   <<TAG_AGENDADO_ID>>    Tag "Agendado"
 *   <<TAG_SEM_INTERESSE_ID>>
 */
import { createId } from "@paralleldrive/cuid2";
import { NodeType } from "@/generated/prisma/enums";

export interface AgendamentoParams {
  organizationId: string;
  trackingId: string;
  name?: string;
}

export function buildAgendamentoBlueprint(params: AgendamentoParams) {
  const ids = {
    triggerNewLead: "trg-new-lead",
    aiGenSaudacao: "ai-gen-saudacao",
    sendSaudacao: "act-send-saudacao",
    waitResposta: "ctl-wait-resp",
    decideAgendar: "ai-decide-agendar",
    sendAgenda: "act-send-agenda",
    waitAgendamento: "ctl-wait-agend",
    aiGenBoasVindas: "ai-gen-boas",
    sendBoasVindas: "act-send-boas",
    tagAgendado: "act-tag-agendado",
    tagSemInteresse: "act-tag-sem-int",
  } as const;

  const nodes: Array<{
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }> = [
    {
      id: ids.triggerNewLead,
      type: NodeType.NEW_LEAD,
      position: { x: 0, y: 0 },
      data: {},
    },
    {
      id: ids.aiGenSaudacao,
      type: NodeType.AI_GENERATE_TEXT,
      position: { x: 280, y: 0 },
      data: {
        organizationId: params.organizationId,
        tone: "amigável e acolhedor",
        prompt:
          "Cumprimente o lead {{lead.name}} de forma natural, apresente brevemente o serviço, e pergunte se ele gostaria de agendar uma conversa.",
        maxTokens: 200,
      },
    },
    {
      id: ids.sendSaudacao,
      type: NodeType.SEND_MESSAGE,
      position: { x: 560, y: 0 },
      data: {
        action: {
          payload: { type: "TEXT", message: "{{vars.lastGeneratedText}}" },
        },
      },
    },
    {
      id: ids.waitResposta,
      type: NodeType.WAIT_FOR_EVENT,
      position: { x: 840, y: 0 },
      data: {
        eventName: "message-incoming",
        timeoutMinutes: 60 * 24,
      },
    },
    {
      id: ids.decideAgendar,
      type: NodeType.AI_DECISION,
      position: { x: 1120, y: 0 },
      data: {
        organizationId: params.organizationId,
        prompt:
          "Analise a última mensagem do lead. Ele quer agendar uma conversa/atendimento, ou não?",
        branches: [
          {
            id: "yes",
            label: "Quer agendar",
            description: "Disse 'sim', 'quero agendar', 'pode marcar', etc.",
          },
          {
            id: "no",
            label: "Não quer / não respondeu claramente",
            description: "Recusou, ignorou, ou não deu sinal claro",
          },
        ],
      },
    },
    // Branch "yes"
    {
      id: ids.sendAgenda,
      type: NodeType.SEND_AGENDA,
      position: { x: 1400, y: -100 },
      data: { action: { agendaId: "<<AGENDA_ID>>" } },
    },
    {
      id: ids.waitAgendamento,
      type: NodeType.WAIT_FOR_EVENT,
      position: { x: 1680, y: -100 },
      data: {
        eventName: "agenda-confirmed",
        timeoutMinutes: 60 * 48,
      },
    },
    {
      id: ids.aiGenBoasVindas,
      type: NodeType.AI_GENERATE_TEXT,
      position: { x: 1960, y: -100 },
      data: {
        organizationId: params.organizationId,
        tone: "caloroso",
        prompt:
          "O lead {{lead.name}} acabou de confirmar o agendamento. Mande uma mensagem curta confirmando, agradecendo e dizendo que aguardamos com expectativa.",
        maxTokens: 180,
      },
    },
    {
      id: ids.sendBoasVindas,
      type: NodeType.SEND_MESSAGE,
      position: { x: 2240, y: -100 },
      data: {
        action: {
          payload: { type: "TEXT", message: "{{vars.lastGeneratedText}}" },
        },
      },
    },
    {
      id: ids.tagAgendado,
      type: NodeType.TAG,
      position: { x: 2520, y: -100 },
      data: {
        action: { type: "ADD", tagsIds: ["<<TAG_AGENDADO_ID>>"] },
      },
    },
    // Branch "no"
    {
      id: ids.tagSemInteresse,
      type: NodeType.TAG,
      position: { x: 1400, y: 120 },
      data: {
        action: { type: "ADD", tagsIds: ["<<TAG_SEM_INTERESSE_ID>>"] },
      },
    },
  ];

  const edges: Array<{
    id: string;
    fromNodeId: string;
    toNodeId: string;
    fromOutput: string;
    toInput: string;
  }> = [
    { id: "e1", fromNodeId: ids.triggerNewLead, toNodeId: ids.aiGenSaudacao, fromOutput: "main", toInput: "main" },
    { id: "e2", fromNodeId: ids.aiGenSaudacao, toNodeId: ids.sendSaudacao, fromOutput: "main", toInput: "main" },
    { id: "e3", fromNodeId: ids.sendSaudacao, toNodeId: ids.waitResposta, fromOutput: "main", toInput: "main" },
    { id: "e4", fromNodeId: ids.waitResposta, toNodeId: ids.decideAgendar, fromOutput: "main", toInput: "main" },
    { id: "e5", fromNodeId: ids.decideAgendar, toNodeId: ids.sendAgenda, fromOutput: "yes", toInput: "main" },
    { id: "e6", fromNodeId: ids.decideAgendar, toNodeId: ids.tagSemInteresse, fromOutput: "no", toInput: "main" },
    { id: "e7", fromNodeId: ids.sendAgenda, toNodeId: ids.waitAgendamento, fromOutput: "main", toInput: "main" },
    { id: "e8", fromNodeId: ids.waitAgendamento, toNodeId: ids.aiGenBoasVindas, fromOutput: "main", toInput: "main" },
    { id: "e9", fromNodeId: ids.aiGenBoasVindas, toNodeId: ids.sendBoasVindas, fromOutput: "main", toInput: "main" },
    { id: "e10", fromNodeId: ids.sendBoasVindas, toNodeId: ids.tagAgendado, fromOutput: "main", toInput: "main" },
  ];

  return {
    name: params.name ?? "Agente de Agendamento",
    description:
      "Recebe lead novo, conversa com IA, envia link de agenda quando interessado, tagueia 'Agendado' após confirmação.",
    nodes,
    edges,
  };
}
