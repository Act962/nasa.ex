/**
 * Preset "Comprovante de Pagamento — IA Lê o Arquivo" — automatiza o
 * fluxo clássico de cobrança pós-aceite:
 *
 *   1. Lead aceitou a proposta (tag "Proposta Aceita" aplicada)
 *   2. Workflow pede comprovante por WhatsApp (foto/PDF/texto)
 *   3. WAIT_FOR_EVENT(message-incoming, 7d) — espera resposta
 *   4. IA lê o anexo:
 *      - Foto → AI_VISION extrai valor + dados visuais
 *      - PDF → READ_PDF extrai texto
 *      - Texto puro → AI_DECISION interpreta direto
 *   5. AI_DECISION valida: "valor bate?"
 *      ├ pago        → TAG "Pago" + msg confirmação
 *      ├ divergente  → msg pedindo reenvio (volta pro WAIT)
 *      └ sem_resposta (timeout) → msg "Não recebi comprovante"
 *
 * Requer:
 *   - tag-gatilho "Proposta Aceita" (preset proposta-contrato já cria)
 *   - tag "Pago" e "Aguardando Pagamento" (criadas via suggestedTags)
 *   - Trigger pode ser também depois de MOVE_LEAD_STATUS "Cliente"
 *
 * Custo IA: AI_VISION (~3★) + AI_DECISION (~1★) por execução. Pra fluxos
 * com muito comprovante, dimensiona MAX_RUNS por hora no canvas.
 */
import { createId } from "@paralleldrive/cuid2";
import { NodeType } from "@/generated/prisma/enums";

export interface ComprovantePagamentoParams {
  organizationId: string;
  trackingId: string;
  name?: string;
  /** Tag-gatilho (ex: tag "Proposta Aceita" do preset proposta-contrato). */
  triggerTagId?: string;
  /** ID da tag "Pago" — quando criada via suggestedTags, fica `<<TAG_PAGO_ID>>`. */
  tagPagoId?: string;
  /** ID da tag "Aguardando Pagamento" — opcional. */
  tagAguardandoId?: string;
  /** Minutos de espera pelo comprovante. Default 10080 = 7 dias. */
  waitMinutes?: number;
}

export function buildComprovantePagamentoBlueprint(
  params: ComprovantePagamentoParams,
) {
  const waitMin = params.waitMinutes ?? 10080;
  const PH_TRIGGER = params.triggerTagId ?? "<<TAG_PROPOSTA_ACEITA_ID>>";
  const PH_PAGO = params.tagPagoId ?? "<<TAG_PAGO_ID>>";
  const PH_AGUARDANDO =
    params.tagAguardandoId ?? "<<TAG_AGUARDANDO_PAGAMENTO_ID>>";

  const ids = {
    trigger: "trg-proposta-aceita",
    tagAguardando: "tag-aguardando",
    askComprovante: "msg-ask-comprovante",
    waitResposta: "wait-resposta",
    visionImage: "ai-vision-comprovante",
    readPdf: "ai-read-pdf",
    decideValido: "ai-decide-comprovante",
    tagPago: "tag-pago",
    msgConfirmado: "msg-confirmado",
    msgDivergente: "msg-divergente",
    msgTimeout: "msg-timeout",
  } as const;

  type Node = {
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  };

  const nodes: Node[] = [
    // Trigger: lead recebe tag "Proposta Aceita"
    {
      id: ids.trigger,
      type: NodeType.LEAD_TAGGED,
      position: { x: 0, y: 0 },
      data: {
        action: {
          tagIds: [PH_TRIGGER],
          conditions: [],
        },
      },
    },
    // Marca "Aguardando Pagamento" pra ficar visível no kanban
    {
      id: ids.tagAguardando,
      type: NodeType.TAG,
      position: { x: 320, y: 0 },
      data: {
        action: {
          type: "ADD",
          tagsIds: [PH_AGUARDANDO],
        },
      },
    },
    // Pede comprovante
    {
      id: ids.askComprovante,
      type: NodeType.SEND_MESSAGE,
      position: { x: 640, y: 0 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Show, {{lead.name}}! Pra confirmar tudo, me envia o comprovante de pagamento aqui — pode ser uma foto do recibo ou um PDF do banco. Assim que receber, libero o próximo passo. 🤝",
          },
        },
      },
    },
    // Espera o comprovante. Race entre message-incoming (com mídia ou texto)
    // e lead-tagged (caso atendente humano marque "Pago" antes manualmente).
    {
      id: ids.waitResposta,
      type: NodeType.WAIT_FOR_EVENT,
      position: { x: 960, y: 0 },
      data: {
        eventNames: ["message-incoming", "lead-tagged"],
        timeoutMinutes: waitMin,
      },
    },
    // AI_VISION analisa imagem se mediaType=image. Lê valor + banco + data.
    // Se mediaType≠image OU mediaUrl vazio, executor retorna skip → próximo
    // nó (AI_DECISION) usa lastIncomingMessage como fallback.
    {
      id: ids.visionImage,
      type: NodeType.AI_VISION,
      position: { x: 1280, y: -180 },
      data: {
        imageUrl: "{{vars.lastEvent.mediaUrl}}",
        prompt:
          "Analise esta imagem. É um comprovante de pagamento bancário (PIX, TED, boleto)? Se sim, extraia: 1) valor exato pago em R$ (ex: 1500.00), 2) banco emissor, 3) data, 4) destinatário. Responda em texto curto: 'COMPROVANTE: valor R$ X, banco Y, data Z, pra W' ou 'NÃO É COMPROVANTE: <descrição>'.",
        organizationId: params.organizationId,
      },
    },
    // READ_PDF roda em paralelo (executor decide skip se mimetype não é pdf).
    {
      id: ids.readPdf,
      type: NodeType.READ_PDF,
      position: { x: 1280, y: 0 },
      data: {
        pdfUrl: "{{vars.lastEvent.mediaUrl}}",
        prompt:
          "Extraia do PDF: valor pago em R$, banco emissor, data e destinatário. Formato: 'COMPROVANTE: valor R$ X, banco Y, data Z, pra W'. Se não for um comprovante, responda 'NÃO É COMPROVANTE'.",
        organizationId: params.organizationId,
      },
    },
    // AI_DECISION combina todas as fontes (texto, vision, pdf) e decide.
    {
      id: ids.decideValido,
      type: NodeType.AI_DECISION,
      position: { x: 1600, y: 0 },
      data: {
        prompt: `O lead {{lead.name}} respondeu sobre o pagamento.

Fontes disponíveis (use o que tiver):
- Texto do lead: "{{vars.lastIncomingMessage}}"
- Tipo de mídia: {{vars.lastEvent.mediaType}}
- Análise visual (se foto): {{vars.lastVisionResult}}
- Texto do PDF (se documento): {{vars.lastPdfText}}
- Nome do arquivo: {{vars.lastEvent.fileName}}

Classifique:
- **pago**: viu valor real de pagamento em R$ no comprovante OU lead disse claramente "paguei R$ X" / "transferi R$ X"
- **divergente**: lead enviou algo MAS não é um comprovante válido ou valor não bate (ex: "vou pagar amanhã", boleto não pago, print de tela vazia)
- **sem_resposta**: lead só respondeu texto vago sem confirmar pagamento real

Responda APENAS o id (pago | divergente | sem_resposta).`,
        branches: [
          { id: "pago", label: "Pago", description: "Comprovante validado" },
          {
            id: "divergente",
            label: "Divergente",
            description: "Anexo inválido ou valor errado",
          },
          {
            id: "sem_resposta",
            label: "Sem resposta clara",
            description: "Resposta ambígua",
          },
        ],
        organizationId: params.organizationId,
        eventBranchMap: {
          // Se atendente humano marcar "Pago" manualmente, fluxo respeita.
          "lead-tagged": "pago",
        },
        tagBranchMap: {
          [PH_PAGO]: "pago",
        },
        defaultBranchId: "sem_resposta",
      },
    },
    // Branch PAGO
    {
      id: ids.tagPago,
      type: NodeType.TAG,
      position: { x: 1920, y: -180 },
      data: {
        action: {
          type: "ADD",
          tagsIds: [PH_PAGO],
        },
      },
    },
    {
      id: ids.msgConfirmado,
      type: NodeType.SEND_MESSAGE,
      position: { x: 2240, y: -180 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Recebido, {{lead.name}}! ✅ Confirmamos o pagamento. Em instantes alguém do time vai entrar em contato com os próximos passos. Bem-vindo(a)!",
          },
        },
      },
    },
    // Branch DIVERGENTE
    {
      id: ids.msgDivergente,
      type: NodeType.SEND_MESSAGE,
      position: { x: 1920, y: 0 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Oi {{lead.name}}, não consegui validar o que você enviou. Pode reenviar o comprovante (foto nítida ou PDF do banco) com o valor da proposta? Qualquer dúvida me chama.",
          },
        },
      },
    },
    // Branch SEM_RESPOSTA (timeout do WAIT_FOR_EVENT)
    {
      id: ids.msgTimeout,
      type: NodeType.SEND_MESSAGE,
      position: { x: 1920, y: 180 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Oi {{lead.name}}, não recebi o comprovante. Tudo bem com o pagamento? Se precisar reenviar o link da proposta ou tirar alguma dúvida, é só chamar.",
          },
        },
      },
    },
  ];

  const edges = [
    // Cadência principal
    { id: createId(), fromNodeId: ids.trigger, toNodeId: ids.tagAguardando, fromOutput: "main", toInput: "main" },
    { id: createId(), fromNodeId: ids.tagAguardando, toNodeId: ids.askComprovante, fromOutput: "main", toInput: "main" },
    { id: createId(), fromNodeId: ids.askComprovante, toNodeId: ids.waitResposta, fromOutput: "main", toInput: "main" },
    // WAIT → AI_VISION → READ_PDF → AI_DECISION (sequencial, com skip embutido nos executors)
    { id: createId(), fromNodeId: ids.waitResposta, toNodeId: ids.visionImage, fromOutput: "main", toInput: "main" },
    { id: createId(), fromNodeId: ids.visionImage, toNodeId: ids.readPdf, fromOutput: "main", toInput: "main" },
    { id: createId(), fromNodeId: ids.readPdf, toNodeId: ids.decideValido, fromOutput: "main", toInput: "main" },
    // Branches
    { id: createId(), fromNodeId: ids.decideValido, toNodeId: ids.tagPago, fromOutput: "pago", toInput: "main" },
    { id: createId(), fromNodeId: ids.tagPago, toNodeId: ids.msgConfirmado, fromOutput: "main", toInput: "main" },
    { id: createId(), fromNodeId: ids.decideValido, toNodeId: ids.msgDivergente, fromOutput: "divergente", toInput: "main" },
    { id: createId(), fromNodeId: ids.decideValido, toNodeId: ids.msgTimeout, fromOutput: "sem_resposta", toInput: "main" },
  ];

  return {
    name: params.name ?? "Comprovante de Pagamento — IA Lê o Arquivo",
    description:
      "Quando o lead recebe a tag 'Proposta Aceita', pede o comprovante e aguarda resposta (7 dias). IA lê foto/PDF, valida o valor, e marca 'Pago' automaticamente. Se for divergente ou timeout, manda mensagem de retomada.",
    suggestedTags: [
      {
        slug: "pago",
        name: "Pago",
        color: "#3DB88B",
        reason: "Marca lead após validar comprovante",
      },
      {
        slug: "aguardando-pagamento",
        name: "Aguardando Pagamento",
        color: "#FFA500",
        reason: "Visibilidade do estado intermediário no kanban",
      },
    ],
    nodes,
    edges,
  };
}
