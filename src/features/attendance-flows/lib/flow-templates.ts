// Modelos prontos do FlowAstro (spec 0140, RF-11). Cada modelo é um desenho comum: depois de criado, a empresa muda o que
// quiser no editor. Ids gerados na hora para dois fluxos do mesmo modelo não dividirem nós.
import { createId } from "@paralleldrive/cuid2";
import { buttonOutputId, NO_CLICK_OUTPUT } from "@/features/workflows/lib/button-reply-flow";
import { ASK_QUESTION_OUTPUTS, PROMO_ENROLL_OUTPUTS, PROMO_LOOKUP_OUTPUTS, PROMO_RECEIPT_OUTPUTS } from "./nodes";

export const FLOW_TEMPLATES = [
  { key: "blank", label: "Em branco", description: "Só o bloco inicial" },
  {
    key: "promo_coupon",
    label: "Promoção com cupom",
    description: "Menu, inscrição na promoção, cadastro do cupom, pontos e códigos, com a IA para as dúvidas (STAR FRIENDS)",
  },
] as const;

export type FlowTemplateKey = (typeof FLOW_TEMPLATES)[number]["key"];

export interface TemplateNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface TemplateEdge {
  source: string;
  /** Saída do bloco; `main` é a saída única. */
  sourceOutput: string;
  target: string;
}

const START_DATA = { mode: "DEFAULT", keywords: [], matchMode: "CONTAINS" };

function textMessage(message: string): Record<string, unknown> {
  return { action: { payload: { type: "TEXT", message, bodyText: message, buttons: [] } } };
}

function menuMessage(message: string, buttons: { id: string; text: string }[], menuFormat: "BUTTON" | "LIST" = "BUTTON"): Record<string, unknown> {
  return {
    action: {
      payload: { type: "BUTTONS", mode: "inline", waitForReply: true, message, bodyText: message, buttons, menuFormat, ...(menuFormat === "LIST" ? { listButton: "Ver opções" } : {}) },
    },
  };
}

function blankTemplate(): { nodes: TemplateNode[]; edges: TemplateEdge[] } {
  return { nodes: [{ id: createId(), type: "ATTENDANCE_START", position: { x: 0, y: 0 }, data: START_DATA }], edges: [] };
}

/** A mesma conversa da campanha da spec 0102 (prints de 2026-11-05), montada com os blocos da spec 0140. */
function promoCouponTemplate(): { nodes: TemplateNode[]; edges: TemplateEdge[] } {
  const ids = {
    start: createId(),
    welcome: createId(),
    enroll: createId(),
    enrolled: createId(),
    memberMenu: createId(),
    askPhoto: createId(),
    receipt: createId(),
    points: createId(),
    pointsMessage: createId(),
    codes: createId(),
    codesMessage: createId(),
    wrongPhone: createId(),
    refused: createId(),
    closed: createId(),
    assistant: createId(),
  };
  const column = (index: number) => index * 340;
  const nodes: TemplateNode[] = [
    { id: ids.start, type: "ATTENDANCE_START", position: { x: column(0), y: 0 }, data: START_DATA },
    {
      id: ids.welcome,
      type: "SEND_MESSAGE",
      position: { x: column(1), y: 0 },
      data: menuMessage(
        "Olá, {{primeiro_nome}}! 👋 Este é o WhatsApp da nossa promoção.\n\nEscolha uma opção:",
        [
          { id: "promo", text: "Promoção" },
          { id: "duvida", text: "Tirar dúvida" },
        ],
        "LIST",
      ),
    },
    { id: ids.enroll, type: "PROMO_ENROLL", position: { x: column(2), y: 0 }, data: { nameSource: "ASK", nameVariable: "" } },
    { id: ids.enrolled, type: "SEND_MESSAGE", position: { x: column(3), y: -260 }, data: textMessage("Cadastro feito! ✅") },
    { id: ids.refused, type: "SEND_MESSAGE", position: { x: column(3), y: 360 }, data: textMessage("Tudo bem. Sem o aceite das regras não é possível participar. Se mudar de ideia, é só voltar aqui.") },
    { id: ids.closed, type: "SEND_MESSAGE", position: { x: column(3), y: 560 }, data: textMessage("A promoção não está ativa no momento.") },
    {
      id: ids.memberMenu,
      type: "SEND_MESSAGE",
      position: { x: column(3), y: 0 },
      data: menuMessage("{{primeiro_nome}}, o que você quer fazer?", [
        { id: "novo_cupom", text: "Cadastrar novo cupom" },
        { id: "pontos", text: "Ver meus pontos" },
        { id: "codigos", text: "Ver meus códigos" },
      ]),
    },
    {
      id: ids.askPhoto,
      type: "ASK_QUESTION",
      position: { x: column(4), y: -260 },
      data: {
        question: "Envie agora a *foto do cupom* da sua compra. Mostre o cupom inteiro, com o valor total e a data.",
        answerType: "FILE",
        variableName: "foto_cupom",
        maxAttempts: 3,
        invalidMessage: "Preciso da *foto do cupom*. Toque no clipe 📎 e envie a imagem.",
      },
    },
    { id: ids.receipt, type: "PROMO_RECEIPT", position: { x: column(5), y: -260 }, data: { photoVariable: "foto_cupom", sendDefaultReply: true } },
    { id: ids.points, type: "PROMO_LOOKUP", position: { x: column(4), y: 100 }, data: { askPhone: true } },
    {
      id: ids.pointsMessage,
      type: "SEND_MESSAGE",
      position: { x: column(5), y: 100 },
      data: textMessage(
        "*Seus pontos*\n\nCompras cadastradas: {{vars.total_compras}} em {{vars.qtd_cupons}} cupom(ns)\nNúmeros da sorte: {{vars.qtd_numeros}}\nSaldo para o próximo número: {{vars.saldo_proximo_numero}}",
      ),
    },
    { id: ids.codes, type: "PROMO_LOOKUP", position: { x: column(4), y: 420 }, data: { askPhone: true } },
    { id: ids.codesMessage, type: "SEND_MESSAGE", position: { x: column(5), y: 420 }, data: textMessage("*Seus números da sorte ({{vars.qtd_numeros}})*\n\n{{vars.numeros_da_sorte}}") },
    { id: ids.wrongPhone, type: "SEND_MESSAGE", position: { x: column(5), y: 700 }, data: textMessage("Você não está acessando pelo dispositivo que se cadastrou na promoção.") },
    {
      id: ids.assistant,
      type: "AI_AGENT",
      position: { x: column(2), y: 520 },
      data: {
        instructions: "Tire as dúvidas do cliente sobre a promoção e a loja. Nunca cadastre cupom nem informe números da sorte: para isso, peça para ele escolher \"Promoção\" no menu.",
        goal: "",
        maxReplies: 20,
        intents: [],
        fields: [],
      },
    },
  ];
  const promoButton = buttonOutputId("promo");
  const edges: TemplateEdge[] = [
    { source: ids.start, sourceOutput: "main", target: ids.welcome },
    { source: ids.welcome, sourceOutput: promoButton, target: ids.enroll },
    { source: ids.welcome, sourceOutput: buttonOutputId("duvida"), target: ids.assistant },
    { source: ids.welcome, sourceOutput: NO_CLICK_OUTPUT, target: ids.assistant },
    { source: ids.enroll, sourceOutput: PROMO_ENROLL_OUTPUTS.enrolled, target: ids.enrolled },
    { source: ids.enroll, sourceOutput: PROMO_ENROLL_OUTPUTS.alreadyEnrolled, target: ids.memberMenu },
    { source: ids.enroll, sourceOutput: PROMO_ENROLL_OUTPUTS.refused, target: ids.refused },
    { source: ids.enroll, sourceOutput: PROMO_ENROLL_OUTPUTS.closed, target: ids.closed },
    { source: ids.enroll, sourceOutput: PROMO_ENROLL_OUTPUTS.other, target: ids.assistant },
    { source: ids.enrolled, sourceOutput: "main", target: ids.askPhoto },
    { source: ids.memberMenu, sourceOutput: buttonOutputId("novo_cupom"), target: ids.askPhoto },
    { source: ids.memberMenu, sourceOutput: buttonOutputId("pontos"), target: ids.points },
    { source: ids.memberMenu, sourceOutput: buttonOutputId("codigos"), target: ids.codes },
    { source: ids.memberMenu, sourceOutput: NO_CLICK_OUTPUT, target: ids.assistant },
    { source: ids.askPhoto, sourceOutput: ASK_QUESTION_OUTPUTS.answered, target: ids.receipt },
    { source: ids.askPhoto, sourceOutput: ASK_QUESTION_OUTPUTS.invalid, target: ids.memberMenu },
    // Foto que precisa ser refeita volta ao pedido da foto; o resto volta ao menu do inscrito.
    { source: ids.receipt, sourceOutput: PROMO_RECEIPT_OUTPUTS.unreadable, target: ids.askPhoto },
    { source: ids.receipt, sourceOutput: PROMO_RECEIPT_OUTPUTS.notValid, target: ids.askPhoto },
    { source: ids.receipt, sourceOutput: PROMO_RECEIPT_OUTPUTS.accepted, target: ids.memberMenu },
    { source: ids.receipt, sourceOutput: PROMO_RECEIPT_OUTPUTS.duplicate, target: ids.memberMenu },
    { source: ids.receipt, sourceOutput: PROMO_RECEIPT_OUTPUTS.inReview, target: ids.memberMenu },
    { source: ids.receipt, sourceOutput: PROMO_RECEIPT_OUTPUTS.dailyLimit, target: ids.memberMenu },
    { source: ids.receipt, sourceOutput: PROMO_RECEIPT_OUTPUTS.tryLater, target: ids.memberMenu },
    { source: ids.receipt, sourceOutput: PROMO_RECEIPT_OUTPUTS.notEnrolled, target: ids.enroll },
    { source: ids.receipt, sourceOutput: PROMO_RECEIPT_OUTPUTS.closed, target: ids.closed },
    { source: ids.points, sourceOutput: PROMO_LOOKUP_OUTPUTS.done, target: ids.pointsMessage },
    { source: ids.points, sourceOutput: PROMO_LOOKUP_OUTPUTS.notEnrolled, target: ids.enroll },
    { source: ids.points, sourceOutput: PROMO_LOOKUP_OUTPUTS.phoneMismatch, target: ids.wrongPhone },
    { source: ids.points, sourceOutput: PROMO_LOOKUP_OUTPUTS.other, target: ids.assistant },
    { source: ids.codes, sourceOutput: PROMO_LOOKUP_OUTPUTS.done, target: ids.codesMessage },
    { source: ids.codes, sourceOutput: PROMO_LOOKUP_OUTPUTS.notEnrolled, target: ids.enroll },
    { source: ids.codes, sourceOutput: PROMO_LOOKUP_OUTPUTS.phoneMismatch, target: ids.wrongPhone },
    { source: ids.codes, sourceOutput: PROMO_LOOKUP_OUTPUTS.other, target: ids.assistant },
    { source: ids.pointsMessage, sourceOutput: "main", target: ids.memberMenu },
    { source: ids.codesMessage, sourceOutput: "main", target: ids.memberMenu },
    { source: ids.wrongPhone, sourceOutput: "main", target: ids.welcome },
  ];
  return { nodes, edges };
}

export function buildFlowTemplate(key: FlowTemplateKey): { nodes: TemplateNode[]; edges: TemplateEdge[] } {
  return key === "promo_coupon" ? promoCouponTemplate() : blankTemplate();
}
