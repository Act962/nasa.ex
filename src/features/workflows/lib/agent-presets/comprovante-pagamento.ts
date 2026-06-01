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
    // AI_VISION analisa imagem (foto de comprovante). Extrai 8 campos via
    // OpenAI Vision (fallback Gemini se quota). Lê path direto do contexto
    // via `imagePath`/`instruction` (executor faz getByPath — NÃO usa
    // interpolação {{}}). Quando OpenAI falha, cai pro Gemini que vê o
    // prompt completo (com contexto temporal injetado evita falso-positivo
    // de adulteração).
    {
      id: ids.visionImage,
      type: NodeType.AI_VISION,
      position: { x: 1280, y: -180 },
      data: {
        imagePath: "vars.lastEvent.mediaUrl",
        instruction: `Você é um especialista em comprovantes de pagamento bancário brasileiros (PIX, TED, DOC, boleto, recibo). Analise esta imagem com MUITA atenção.

CONTEXTO TEMPORAL: a data de hoje é a data atual real (consulte o system context se disponível). Datas até hoje NÃO são suspeitas de adulteração.

Identifique INDEPENDENTEMENTE DO BANCO ou tipo de operação:
1) Esta imagem É um comprovante de transação financeira REAL? (sim/não)
2) Valor exato pago em R$ (formato BR: 100,00 ou 1.500,00)
3) Nome COMPLETO do REMETENTE/pagador (quem ENVIOU o dinheiro)
4) Nome do destinatário (quem RECEBEU)
5) Data da operação (DD/MM/AAAA ou variantes)
6) Banco emissor (Itaú, Nubank, Bradesco, BB, Santander, Inter, C6, PagBank, etc — extraia mesmo de logos)
7) ID/código da transação (ex: "ID: E1234abc", "transação 123456789", "PIX ID")
8) Sinal de adulteração? (cores erradas, textos sobrepostos, datas/valores recortados, ruído estranho — descreva o que viu)

FORMATO DE RESPOSTA (texto plano, sem markdown):
COMPROVANTE: sim|nao
VALOR: 100,00
REMETENTE: <nome completo OU "não identificado">
DESTINATARIO: <nome OU "não identificado">
DATA: <data OU "não identificada">
BANCO: <banco OU "não identificado">
ID_TRANSACAO: <id OU "não encontrado">
SUSPEITA_ADULTERACAO: nao|sim — <descrição se sim>
OBSERVACOES: <qualquer coisa relevante: tipo de operação PIX/TED, instituição destinatária, chave PIX, formato suspeito>

Se NÃO for comprovante de pagamento, responda apenas:
NAO_E_COMPROVANTE: <descreva o que é>`,
        organizationId: params.organizationId,
      },
    },
    // READ_PDF: extrai texto via pdf-parse + LLM resume. Executor skipa
    // automaticamente se vars.lastEvent.mediaType ≠ document (não roda
    // pra imagens — usa apenas AI_VISION nesse caso).
    {
      id: ids.readPdf,
      type: NodeType.READ_PDF,
      position: { x: 1280, y: 0 },
      data: {
        pdfPath: "vars.lastEvent.mediaUrl",
        instruction: `Você está extraindo dados de um PDF que PODE ser um comprovante bancário (PIX, TED, DOC, boleto, recibo). Analise o texto extraído com atenção.

Identifique INDEPENDENTEMENTE DO BANCO:
1) É um comprovante de transação financeira real? (sim/não)
2) Valor pago em R$
3) Nome completo do REMETENTE (pagador)
4) Nome do destinatário
5) Data da operação
6) Banco emissor
7) ID/código da transação
8) Sinal de adulteração no texto?

FORMATO (texto plano):
COMPROVANTE: sim|nao
VALOR: <valor>
REMETENTE: <nome OU "não identificado">
DESTINATARIO: <nome OU "não identificado">
DATA: <data>
BANCO: <banco>
ID_TRANSACAO: <id>
SUSPEITA_ADULTERACAO: nao|sim
OBSERVACOES: <relevante>

Se não for comprovante:
NAO_E_COMPROVANTE: <descreva>`,
        organizationId: params.organizationId,
      },
    },
    // AI_DECISION combina todas as fontes (texto, vision, pdf) e valida
    // 4 critérios (valor + remetente + data + autenticidade). Fallback
    // tier 1 = Gemini (vê prompt completo com vars.lastVisionResult),
    // tier 2 = heurístico Jaccard (só texto do lead), default sem_resposta.
    {
      id: ids.decideValido,
      type: NodeType.AI_DECISION,
      position: { x: 1600, y: 0 },
      data: {
        prompt: `Você está validando se o pagamento do lead {{lead.name}} foi confirmado.

Fontes disponíveis (use TODAS):
- Texto do lead: "{{vars.lastIncomingMessage}}"
- Tipo de mídia: {{vars.lastEvent.mediaType}}
- Nome do arquivo: {{vars.lastEvent.fileName}}
- Análise visual (se foto): {{vars.lastVisionResult}}
- Texto do PDF (se documento): {{vars.lastPdfSummary}}

VALIDAÇÃO ESTRITA (todos os 4 critérios precisam passar pra "pago"):

1) **VALOR**: o comprovante mostra valor compatível com a proposta? (Considere R$ exato OU próximo com até R$ 1 de diferença por arredondamento). Sem valor visível = divergente.

2) **REMETENTE**: o nome do REMETENTE/pagador no comprovante bate com "{{lead.name}}"?
   - Comparação TOLERANTE: aceita variações de capitalização, abreviações, nome social vs completo, com/sem segundo nome ou sobrenome.
   - Se nome do lead for GENÉRICO ("Atendimento", "Cliente", "Lead"), aceita qualquer remetente real.
   - Se REMETENTE vier "não identificado" mas valor + data + banco corretos, classifique como **divergente** (precisa revisão humana).
   - Se REMETENTE for CLARAMENTE outra pessoa não relacionada ao lead, classifique como **divergente**.

3) **DATA**: data do pagamento existe e é recente (até 7 dias atrás)?

4) **AUTENTICIDADE**: SUSPEITA_ADULTERACAO=nao? Se sim, classifique como **divergente** mesmo que tudo bata.

CLASSIFICAÇÃO:
- **pago**: todos os 4 critérios passam
- **divergente**: enviou algo mas falhou em 1+ critério (valor errado, remetente diferente, suspeita)
- **sem_resposta**: lead só respondeu texto sem comprovante OU não respondeu nada

Responda APENAS o id (pago | divergente | sem_resposta).`,
        branches: [
          { id: "pago", label: "Pago", description: "Comprovante validado" },
          {
            id: "divergente",
            label: "Divergente",
            description: "Anexo inválido, valor errado ou suspeita",
          },
          {
            id: "sem_resposta",
            label: "Sem resposta clara",
            description: "Resposta ambígua ou ausente",
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
