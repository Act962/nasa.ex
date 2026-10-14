/**
 * Fluxos prontos da venda guiada pelo Catálogo online (spec 0104, D-5). Nascem pausados para a equipe
 * revisar textos e setores antes de ligar. O Astro segue conversando; estes fluxos fazem as etapas
 * operacionais e mandam as mensagens das etapas (com template quando a janela de 24h fechou).
 *
 *   1. Chegada do pedido (tag "Pedido do catálogo"): pergunta do consultor → crédito em silêncio.
 *   2. Aprovação do valor (tag "Valor em aprovação"): setores aprovam → CPF/CNPJ → valor, prazo e pontos ao cliente.
 *   3. Pagamento (Pagamento recebido do catálogo): "estamos conferindo" → financeiro e logística → prazo novo? → link.
 */
import { NodeType } from "@/generated/prisma/enums";
import type { ApprovalTemplateNames } from "@/features/nerp-catalog/lib/approvals/approval-rules";
import type { Blueprint, BlueprintEdge, BlueprintNode } from "./create-from-blueprint";

export const GUIDED_SALE_TAGS = [
  { slug: "pedido-do-catalogo", name: "Pedido do catálogo", color: "#0ea5e9" },
  { slug: "valor-em-aprovacao", name: "Valor em aprovação", color: "#6366f1" },
] as const;

const TEMPLATE_LANGUAGE = "pt_BR";
const STEP_X = 320;

function edge(fromNodeId: string, toNodeId: string, fromOutput = "main"): BlueprintEdge {
  return { fromNodeId, toNodeId, fromOutput, toInput: "main" };
}

function textMessage(text: string, fallbackTemplate?: Record<string, unknown>) {
  return { action: { payload: { type: "TEXT", message: text }, ...(fallbackTemplate ? { fallbackTemplate } : {}) } };
}

function notifyTeam(message: string) {
  return { target: "RESPONSIBLE", message };
}

function tagTrigger(slug: string) {
  return { action: { tagIds: [`{{TAG:${slug}}}`], conditions: [] } };
}

function buildArrivalFlow(): Blueprint {
  const nodes: BlueprintNode[] = [
    { id: "trigger", type: NodeType.LEAD_TAGGED, position: { x: 0, y: 0 }, data: tagTrigger("pedido-do-catalogo"), name: "Pedido do catálogo chegou" },
    {
      id: "consultant",
      type: NodeType.ROUTE_TO_CONSULTANT,
      position: { x: STEP_X, y: 0 },
      data: { question: "Oi! Recebi seu pedido aqui 🛒 E toda compra vale pontos pra trocar por brindes 🎁\n\nVocê já tem algum consultor que te atende? Se tiver, me fala o nome dele 😊", timeoutMinutes: 1440, timeoutMode: "customer_window" },
      name: "Já tem consultor?",
    },
    {
      id: "handoff-message",
      type: NodeType.SEND_MESSAGE,
      position: { x: STEP_X * 2, y: -160 },
      data: textMessage("Show! Já passei seu pedido pro {{vars.consultor.nome}}, ele te chama aqui já já 😉"),
      name: "Avisa que passou ao consultor",
    },
    { id: "credit", type: NodeType.CHECK_CREDIT, position: { x: STEP_X * 2, y: 160 }, data: {}, name: "Crédito (em silêncio)" },
    {
      id: "credit-alert",
      type: NodeType.NOTIFY_TEAM,
      position: { x: STEP_X * 3, y: 260 },
      data: notifyTeam("{{lead.name}} fez pedido no catálogo e tem conta vencida ({{vars.credito.totalVencido}}). Confira antes de aprovar."),
      name: "Avisa inadimplência",
    },
  ];
  return {
    name: "Venda guiada — chegada do pedido",
    description: "Pergunta se o cliente já tem consultor (e passa para ele) e confere o crédito sem perguntar nada.",
    nodes,
    edges: [
      edge("trigger", "consultant"),
      edge("consultant", "handoff-message", "found"),
      // Quem já tem consultor também passa pelo crédito (decisão do usuário): o aviso vai ao consultor.
      edge("handoff-message", "credit"),
      edge("consultant", "credit", "not_found"),
      edge("credit", "credit-alert", "overdue"),
    ],
  };
}

function buildQuoteApprovalFlow(templates: ApprovalTemplateNames): Blueprint {
  const quoteText = [
    "Oi, {{vars.pedido.cliente}}! O valor do seu pedido #{{vars.pedido.numero}} está pronto 😊",
    "",
    "- Itens: {{vars.pedido.itens}}",
    "",
    "- Total: {{vars.pedido.total}}",
    "",
    "- Entrega: {{vars.pedido.entrega}}",
    "",
    "{{vars.pedido.pontos}}",
    "",
    "Podemos fechar?",
  ].join("\n");
  const nodes: BlueprintNode[] = [
    { id: "trigger", type: NodeType.LEAD_TAGGED, position: { x: 0, y: 0 }, data: tagTrigger("valor-em-aprovacao"), name: "Consultor enviou o valor" },
    {
      id: "approval",
      type: NodeType.SALES_APPROVAL,
      position: { x: STEP_X, y: 0 },
      data: { round: "PRE_PAYMENT", sectors: ["COMMERCIAL", "FINANCE", "LOGISTICS"], timeoutMinutes: 1440 },
      name: "Setores aprovam",
    },
    {
      id: "document",
      type: NodeType.FIND_CUSTOMER_BY_DOCUMENT,
      position: { x: STEP_X * 2, y: -160 },
      data: { source: "text", question: "Tá quase! Pra eu fechar seu pedido, me passa seu CPF ou CNPJ?", timeoutMinutes: 720, timeoutMode: "customer_window" },
      name: "CPF/CNPJ",
    },
    {
      id: "quote",
      type: NodeType.SEND_MESSAGE,
      position: { x: STEP_X * 3, y: -160 },
      data: textMessage(quoteText, {
        templateName: templates.quoteToCustomer,
        languageCode: TEMPLATE_LANGUAGE,
        bodyParameters: ["{{vars.pedido.cliente}}", "{{vars.pedido.numero}}", "{{vars.pedido.total}}", "{{vars.pedido.entrega}}", "{{vars.pedido.pontos}}"],
      }),
      name: "Valor, prazo e pontos ao cliente",
    },
    {
      id: "rejected",
      type: NodeType.NOTIFY_TEAM,
      position: { x: STEP_X * 2, y: 160 },
      data: notifyTeam("Pedido #{{vars.pedido.numero}} voltou da aprovação: {{vars.pedido.motivos}}. Ajuste e envie o valor de novo."),
      name: "Volta ao consultor",
    },
    {
      id: "timeout",
      type: NodeType.NOTIFY_TEAM,
      position: { x: STEP_X * 2, y: 320 },
      data: notifyTeam("A janela de 24h de {{lead.name}} está fechando e o pedido ainda não foi aprovado por todos os setores."),
      name: "Aprovação parada",
    },
  ];
  return {
    name: "Venda guiada — aprovação do valor",
    description: "Quando o consultor envia o valor: comercial, financeiro, logística e contábil aprovam pelo WhatsApp; depois o cliente recebe valor, prazo e pontos.",
    nodes,
    edges: [
      edge("trigger", "approval"),
      edge("approval", "document", "approved"),
      edge("document", "quote", "returning"),
      edge("document", "quote", "new"),
      edge("document", "quote", "no_document"),
      edge("approval", "rejected", "rejected"),
      edge("approval", "timeout", "timeout"),
    ],
  };
}

function buildPaymentFlow(params: { templates: ApprovalTemplateNames; organizationId: string; registration: RegistrationForm | null }): Blueprint {
  const { templates, organizationId, registration } = params;
  const releasedTemplate = {
    templateName: templates.orderReleased,
    languageCode: TEMPLATE_LANGUAGE,
    bodyParameters: ["{{vars.pedido.cliente}}", "{{vars.pedido.numero}}", "{{vars.pedido.entrega}}"],
    urlButtonSuffix: "{{vars.pedido.codigo}}",
    urlButtonIndex: 0,
  };
  const nodes: BlueprintNode[] = [
    { id: "trigger", type: NodeType.PAYMENT_RECEIVED, position: { x: 0, y: 0 }, data: { action: { conditions: [] } }, name: "Pagamento recebido" },
    {
      id: "is-catalog",
      type: NodeType.IF_CONDITION,
      position: { x: STEP_X, y: 0 },
      data: { conditions: [{ field: "trigger.source", operator: "eq", value: "catalog_order" }], combinator: "AND" },
      name: "É pedido do catálogo?",
    },
    { id: "load", type: NodeType.CATALOG_ORDER_ACTION, position: { x: STEP_X * 2, y: 0 }, data: { action: "load" }, name: "Carrega o pedido" },
    {
      id: "in-review",
      type: NodeType.SEND_MESSAGE,
      position: { x: STEP_X * 3, y: 0 },
      data: textMessage(
        "Oi, {{vars.pedido.cliente}}! Recebemos o pagamento do pedido #{{vars.pedido.numero}} ({{vars.pedido.total}}) ✅\n\nEstamos conferindo o pedido e já te confirmo a entrega 😉",
        { templateName: templates.paymentInReview, languageCode: TEMPLATE_LANGUAGE, bodyParameters: ["{{vars.pedido.cliente}}", "{{vars.pedido.numero}}", "{{vars.pedido.total}}"] },
      ),
      name: "Estamos conferindo",
    },
    {
      id: "check",
      type: NodeType.SALES_APPROVAL,
      position: { x: STEP_X * 4, y: 0 },
      data: { round: "POST_PAYMENT", sectors: ["FINANCE", "LOGISTICS"], timeoutMinutes: 1440 },
      name: "Financeiro e logística conferem",
    },
    {
      id: "changed",
      type: NodeType.IF_CONDITION,
      position: { x: STEP_X * 5, y: 0 },
      data: { conditions: [{ field: "vars.pedido.prazoMudou", operator: "eq", value: "sim" }], combinator: "AND" },
      name: "Prazo mudou?",
    },
    {
      id: "ask-change",
      type: NodeType.SEND_MESSAGE,
      position: { x: STEP_X * 6, y: -160 },
      data: textMessage("Oi, {{vars.pedido.cliente}}! A entrega do pedido #{{vars.pedido.numero}} precisou mudar.\n\n- Nova previsão: {{vars.pedido.entrega}}\n\nPode ser assim?", {
        templateName: templates.deliveryChanged,
        languageCode: TEMPLATE_LANGUAGE,
        bodyParameters: ["{{vars.pedido.cliente}}", "{{vars.pedido.numero}}", "{{vars.pedido.entrega}}"],
      }),
      name: "Pergunta do novo prazo",
    },
    {
      id: "wait-answer",
      type: NodeType.CATALOG_ORDER_ACTION,
      position: { x: STEP_X * 7, y: -160 },
      data: { action: "await_reply", timeoutMinutes: 1440, timeoutMode: "customer_window" },
      name: "Espera a resposta",
    },
    {
      id: "decide-change",
      type: NodeType.AI_DECISION,
      position: { x: STEP_X * 8, y: -160 },
      data: {
        prompt:
          'O cliente recebeu um novo prazo de entrega e respondeu: "{{vars.lastIncomingMessage}}". Ele aceitou o novo prazo? Responda APENAS o id (aceitou | nao_aceitou).',
        branches: [
          { id: "aceitou", label: "Aceitou", description: "Concordou com o novo prazo" },
          { id: "nao_aceitou", label: "Não aceitou", description: "Recusou, quer conversar ou não respondeu" },
        ],
        defaultBranchId: "nao_aceitou",
        organizationId,
      },
      name: "Aceitou o prazo?",
    },
    { id: "accept-change", type: NodeType.CATALOG_ORDER_ACTION, position: { x: STEP_X * 9, y: -240 }, data: { action: "approve_delivery_change" }, name: "Registra o novo prazo" },
    {
      id: "refused-change",
      type: NodeType.NOTIFY_TEAM,
      position: { x: STEP_X * 9, y: -80 },
      data: notifyTeam("{{lead.name}} não aceitou o novo prazo do pedido #{{vars.pedido.numero}}. Fale com o cliente."),
      name: "Cliente não aceitou",
    },
    {
      id: "released",
      type: NodeType.SEND_MESSAGE,
      position: { x: STEP_X * 10, y: 0 },
      data: textMessage(
        "Tudo certo com o pedido #{{vars.pedido.numero}} 🎉\n\n- Entrega prevista: {{vars.pedido.entrega}}\n\nAcompanhe por aqui: {{vars.pedido.link}}",
        releasedTemplate,
      ),
      name: "Pedido liberado",
    },
    {
      id: "check-problem",
      type: NodeType.NOTIFY_TEAM,
      position: { x: STEP_X * 5, y: 200 },
      data: notifyTeam("A conferência do pedido #{{vars.pedido.numero}} não fechou: {{vars.pedido.motivos}}"),
      name: "Conferência com problema",
    },
    ...(registration
      ? [
          {
            id: "is-new-customer",
            type: NodeType.IF_CONDITION,
            position: { x: STEP_X * 11, y: 0 },
            data: { conditions: [{ field: "vars.pedido.clienteNovo", operator: "eq", value: "sim" }], combinator: "AND" },
            name: "Cliente novo?",
          },
          {
            id: "registration",
            type: NodeType.SEND_MESSAGE,
            position: { x: STEP_X * 12, y: -80 },
            // Passo existente "Preencher formulário pela conversa" (spec 0099): nome, telefone, CPF e endereço
            // do pedido já vêm preenchidos; só pergunta o que faltar.
            data: {
              action: {
                payload: {
                  type: "FORM_CHAT",
                  formId: registration.formId,
                  fieldIds: registration.fieldIds,
                  askOnlyMissing: true,
                  showSummary: false,
                  fallbackOptionByField: {},
                  replyTimeoutMinutes: 720,
                },
              },
            },
            name: "Cadastro do cliente novo",
          } satisfies BlueprintNode,
        ]
      : []),
  ];
  return {
    name: "Venda guiada — pagamento e liberação",
    description: "Pagamento do catálogo: cliente recebe \"estamos conferindo\", financeiro e logística confirmam, e o cliente recebe o link de acompanhamento com o prazo.",
    nodes,
    edges: [
      edge("trigger", "is-catalog"),
      edge("is-catalog", "load", "true"),
      // Lado a lado: falha no aviso ao cliente não pode impedir a conferência da equipe.
      edge("load", "in-review"),
      edge("load", "check"),
      edge("check", "changed", "approved"),
      edge("changed", "ask-change", "true"),
      edge("changed", "released", "false"),
      edge("ask-change", "wait-answer"),
      edge("wait-answer", "decide-change"),
      edge("decide-change", "accept-change", "aceitou"),
      edge("decide-change", "refused-change", "nao_aceitou"),
      edge("accept-change", "released"),
      edge("check", "check-problem", "rejected"),
      edge("check", "check-problem", "timeout"),
      ...(registration ? [edge("released", "is-new-customer"), edge("is-new-customer", "registration", "true")] : []),
    ],
  };
}

export type RegistrationForm = { formId: string; fieldIds: string[] };

export function buildGuidedSaleBlueprints(params: {
  organizationId: string;
  templates: ApprovalTemplateNames;
  registration?: RegistrationForm | null;
}): Blueprint[] {
  return [
    buildArrivalFlow(),
    buildQuoteApprovalFlow(params.templates),
    buildPaymentFlow({ templates: params.templates, organizationId: params.organizationId, registration: params.registration ?? null }),
  ];
}
