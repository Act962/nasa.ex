// Previsão de erros de um fluxo, lida direto do desenho na tela (spec 0090, seção C).
//
// Módulo puro: não importa nada de servidor nem de React, para rodar no editor a cada
// alteração e em script de verificação. Só é ERRO o que é certo que vai falhar no envio;
// o que pode falhar, dependendo de quando o cliente falou por último, é AVISO.
//
// As regras da API oficial aqui espelham o que o servidor aplica no envio
// (`tracking-chat/lib/customer-window.ts`, `tracking-executions/lib/workflow-outbound.ts`).
// Mudou lá, muda aqui. Conferidas em 11/10/2026.

export type FlowChannelProvider = "meta" | "uazapi" | "none";

export interface FlowChannelFacts {
  provider: FlowChannelProvider;
  /** A automação envia botões pela API oficial (interruptor da seção F ligado). */
  canSendOfficialMenu?: boolean;
  /** Em número fora da API oficial o menu sai como texto numerado (spec 0095). */
  sendsMenuAsNumberedText?: boolean;
}

export interface FlowNodeInput {
  id: string;
  type?: string | null;
  data?: unknown;
}

export interface FlowEdgeInput {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export type FlowDiagnosticCode =
  | "META_WINDOW_NEEDS_TEMPLATE"
  | "META_WINDOW_MAY_BE_CLOSED"
  | "META_WINDOW_CLOSED_IF_NO_REPLY"
  | "META_BUTTONS_BLOCKED"
  | "UNOFFICIAL_MENU_AS_TEXT"
  | "META_VOICE_UNSUPPORTED"
  | "TEMPLATE_NEEDS_OFFICIAL_NUMBER"
  | "NO_NUMBER_CONNECTED"
  | "TOO_MANY_OPTIONS"
  | "OPTION_TITLE_TOO_LONG"
  | "NODE_DISCONNECTED"
  | "TRIGGER_LEADS_NOWHERE"
  | "NODE_INCOMPLETE"
  | "PLACEHOLDER_TEXT"
  | "MENU_OPTION_MISSING";

export interface FlowDiagnostic {
  nodeId: string;
  /** Ligações que chegam e saem do quadro: ficam vermelhas junto com ele quando é erro. */
  edgeIds: string[];
  severity: "error" | "warning";
  code: FlowDiagnosticCode;
  title: string;
  message: string;
  fixHint?: string;
}

export const OFFICIAL_API_LIMITS = {
  windowMinutes: 24 * 60,
  maxButtons: 3,
  maxListRows: 10,
  buttonTitleChars: 20,
  listRowTitleChars: 24,
} as const;

/** Gatilhos em que o cliente acabou de escrever: a janela de 24 h começa aberta. */
const TRIGGERS_WITH_FRESH_INBOUND = new Set(["MESSAGE_INCOMING", "FIRST_CHAT_INTERACTION", "FIRST_INTERACTION_OF_DAY"]);
const TRIGGER_TYPES = new Set([
  "INITIAL",
  "MANUAL_TRIGGER",
  "NEW_LEAD",
  "MOVE_LEAD_STATUS",
  "LEAD_TAGGED",
  "AI_FINISHED",
  "FIRST_CHAT_INTERACTION",
  "LAST_INBOUND_TIMEOUT",
  "FIRST_INTERACTION_OF_DAY",
  "PAYMENT_RECEIVED",
  "MESSAGE_INCOMING",
  "WEBHOOK_EXTERNAL",
  "SCHEDULE_TRIGGER",
  "COMPLIANCE_ITEM_DUE",
]);
/** Quadros que não são passo do fluxo: não entram na conferência de ligações. */
const NON_STEP_TYPES = new Set(["INITIAL", "STICKY_NOTE", "NOTE", "GROUP"]);
const FREE_FORM_PAYLOADS = new Set(["TEXT", "IMAGE", "DOCUMENT"]);
const MINUTES_PER_UNIT: Record<string, number> = { minutes: 1, hours: 60, days: 1440, weeks: 10_080, months: 43_200 };
const MAX_PASSES_PER_NODE = 6;

type Fields = Record<string, unknown>;

/** Quanto tempo, no pior caso, desde a última fala do cliente. `null` = não dá para saber. */
type MinutesSinceInbound = number | null;

/** O que se sabe da janela de 24 h ao chegar num quadro. */
interface WindowState {
  minutes: MinutesSinceInbound;
  /** Passou por um "esperar resposta" de um dia ou mais: se o cliente não respondeu, a janela fechou. */
  hasLongReplyWait: boolean;
}

function asFields(value: unknown): Fields {
  return value && typeof value === "object" ? (value as Fields) : {};
}

/** Quadros clássicos guardam a configuração em `data.action`; os de modo agente, direto em `data`. */
function nodeConfig(node: FlowNodeInput): Fields {
  const data = asFields(node.data);
  const action = asFields(data.action);
  return Object.keys(action).length > 0 ? { ...data, ...action } : data;
}

function waitMinutes(config: Fields): number {
  const unit = String(config.type ?? config.unit ?? "minutes").toLowerCase();
  const amount = Number(config[unit] ?? 0);
  const minutes = (Number.isFinite(amount) ? amount : 0) * (MINUTES_PER_UNIT[unit] ?? 1);
  // Dias e semanas levam também a hora marcada; para a regra das 24 h basta a parte em dias.
  return Math.max(0, minutes);
}

function isWindowCertainlyClosed(minutes: MinutesSinceInbound): boolean {
  return minutes !== null && minutes >= OFFICIAL_API_LIMITS.windowMinutes;
}

function worstMinutes(current: MinutesSinceInbound, incoming: MinutesSinceInbound): MinutesSinceInbound {
  // Fechada com certeza por um caminho basta para o erro: é o pior caso que o envio vai encontrar.
  if (isWindowCertainlyClosed(current) || isWindowCertainlyClosed(incoming)) {
    return Math.max(current ?? 0, incoming ?? 0);
  }
  if (current === null || incoming === null) return null;
  return Math.max(current, incoming);
}

function worstCase(current: WindowState | undefined, incoming: WindowState): WindowState {
  if (!current) return incoming;
  return {
    minutes: worstMinutes(current.minutes, incoming.minutes),
    hasLongReplyWait: current.hasLongReplyWait || incoming.hasLongReplyWait,
  };
}

function isSameState(first: WindowState, second: WindowState): boolean {
  return first.minutes === second.minutes && first.hasLongReplyWait === second.hasLongReplyWait;
}

function hasFallbackTemplate(config: Fields): boolean {
  const fallback = asFields(config.fallbackTemplate);
  return typeof fallback.templateName === "string" && fallback.templateName.trim().length > 0;
}

function sendsToTheLead(config: Fields): boolean {
  return asFields(config.target).sendMode !== "CUSTOM";
}

const WINDOW_ERROR_MESSAGE =
  "Você não pode enviar mensagem para esse lead fora do prazo de 24h. É necessário enviar um template: selecione o template e, depois que o cliente responder, o fluxo volta ao normal.";

export function diagnoseFlow(nodes: FlowNodeInput[], edges: FlowEdgeInput[], facts: FlowChannelFacts): FlowDiagnostic[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, FlowEdgeInput[]>();
  const touching = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    touching.set(edge.source, [...(touching.get(edge.source) ?? []), edge.id]);
    touching.set(edge.target, [...(touching.get(edge.target) ?? []), edge.id]);
  }

  // Passo 1: quanto tempo desde a última fala do cliente ao CHEGAR em cada quadro, no pior caminho.
  const arrival = new Map<string, WindowState>();
  /** Ordem em que o fluxo alcança cada quadro, a partir dos gatilhos. */
  const reachOrder: string[] = [];
  const passes = new Map<string, number>();
  const queue: { nodeId: string; state: WindowState }[] = nodes
    .filter((node) => TRIGGER_TYPES.has(String(node.type)))
    .map((node) => ({
      nodeId: node.id,
      state: { minutes: TRIGGERS_WITH_FRESH_INBOUND.has(String(node.type)) ? 0 : null, hasLongReplyWait: false },
    }));

  while (queue.length > 0) {
    const { nodeId, state } = queue.shift()!;
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const known = arrival.get(nodeId);
    const merged = worstCase(known, state);
    const visitCount = passes.get(nodeId) ?? 0;
    if (known && isSameState(merged, known)) continue;
    if (visitCount >= MAX_PASSES_PER_NODE) continue;
    passes.set(nodeId, visitCount + 1);
    if (!known) reachOrder.push(nodeId);
    arrival.set(nodeId, merged);

    let afterNode: WindowState = merged;
    const config = nodeConfig(node);
    if (node.type === "WAIT") {
      const waited = waitMinutes(config);
      // Espera de um dia ou mais fecha a janela mesmo sem saber quando o cliente falou.
      const minutes =
        waited >= OFFICIAL_API_LIMITS.windowMinutes
          ? Math.max(waited, merged.minutes ?? 0)
          : merged.minutes === null
            ? null
            : merged.minutes + waited;
      afterNode = { ...merged, minutes };
    } else if (node.type === "WAIT_FOR_EVENT") {
      // Depois deste quadro o cliente pode ter respondido (janela aberta) ou não: os dois seguem pelo
      // mesmo caminho. Com espera de um dia ou mais, o "não respondeu" chega com a janela fechada.
      const timeoutMinutes = Number(config.timeoutMinutes ?? 0);
      afterNode = { minutes: null, hasLongReplyWait: timeoutMinutes >= OFFICIAL_API_LIMITS.windowMinutes };
    } else if (node.type === "SEND_MESSAGE" || node.type === "SEND_MEDIA") {
      // O aviso de "sem resposta não entrega" é dado no primeiro envio depois da espera; os seguintes são o mesmo problema.
      afterNode = { ...merged, hasLongReplyWait: false };
    }
    for (const edge of outgoing.get(nodeId) ?? []) queue.push({ nodeId: edge.target, state: afterNode });
  }

  // Passo 2: regras por quadro.
  const diagnostics: FlowDiagnostic[] = [];
  const report = (node: FlowNodeInput, diagnostic: Omit<FlowDiagnostic, "nodeId" | "edgeIds">) => {
    diagnostics.push({ nodeId: node.id, edgeIds: touching.get(node.id) ?? [], ...diagnostic });
  };
  const isMeta = facts.provider === "meta";
  let hasReportedMissingNumber = false;

  // Aviso de "pode estar fora das 24 h" só no primeiro envio do fluxo: repetido em toda mensagem,
  // ninguém mais lê. O erro (certeza de falha) continua aparecendo em cada quadro.
  let hasWarnedAboutUncertainWindow = false;
  const nodesInFlowOrder = [
    ...reachOrder.map((nodeId) => nodeById.get(nodeId)).filter((node): node is FlowNodeInput => Boolean(node)),
    ...nodes.filter((node) => !arrival.has(node.id)),
  ];

  for (const node of nodesInFlowOrder) {
    const config = nodeConfig(node);
    const isWhatsappSend = node.type === "SEND_MESSAGE" || node.type === "SEND_MEDIA" || node.type === "SEND_VOICE";
    if (!isWhatsappSend) continue;

    if (facts.provider === "none") {
      if (!hasReportedMissingNumber) {
        hasReportedMissingNumber = true;
        report(node, {
          severity: "warning",
          code: "NO_NUMBER_CONNECTED",
          title: "Sem número conectado",
          message: "Este funil não tem número de WhatsApp conectado. As mensagens deste fluxo não saem até conectar um.",
          fixHint: "Conecte um número em Configurações do tracking › Integrações.",
        });
      }
      continue;
    }

    if (node.type === "SEND_VOICE") {
      if (isMeta) {
        report(node, {
          severity: "error",
          code: "META_VOICE_UNSUPPORTED",
          title: "Voz não sai na API oficial",
          message: "O envio de voz por automação só funciona em número não oficial. Neste funil, com a API oficial, este passo falha.",
          fixHint: "Troque por uma mensagem de texto.",
        });
      }
      continue;
    }

    const payload = asFields(config.payload);
    const payloadType = node.type === "SEND_MEDIA" ? "IMAGE" : String(payload.type ?? "TEXT");

    if (payloadType === "TEMPLATE") {
      if (!isMeta) {
        report(node, {
          severity: "error",
          code: "TEMPLATE_NEEDS_OFFICIAL_NUMBER",
          title: "Template só existe na API oficial",
          message: "Este funil usa um número não oficial, que não envia template. Este passo falha.",
          fixHint: "Troque por uma mensagem de texto.",
        });
      }
      continue;
    }

    if (payloadType === "BUTTONS") {
      const buttons = Array.isArray(payload.buttons) ? (payload.buttons as Fields[]) : [];
      if (isMeta && facts.canSendOfficialMenu && payload.mode !== "preset") {
        const isList = payload.menuFormat === "LIST";
        const maxOptions = isList ? OFFICIAL_API_LIMITS.maxListRows : OFFICIAL_API_LIMITS.maxButtons;
        const maxTitleChars = isList ? OFFICIAL_API_LIMITS.listRowTitleChars : OFFICIAL_API_LIMITS.buttonTitleChars;
        const longOption = buttons.find((button) => String(button.text ?? "").length > maxTitleChars);
        if (buttons.length > maxOptions) {
          report(node, {
            severity: "error",
            code: "TOO_MANY_OPTIONS",
            title: "Opções demais para a API oficial",
            message: `A API oficial aceita no máximo ${maxOptions} ${isList ? "itens na lista" : "botões"}; este menu tem ${buttons.length}. O envio é recusado.`,
            fixHint: isList ? "Reduza os itens." : "Reduza para 3 botões ou troque o formato para lista (até 10).",
          });
        } else if (longOption) {
          report(node, {
            severity: "error",
            code: "OPTION_TITLE_TOO_LONG",
            title: "Texto da opção longo demais",
            message: `"${String(longOption.text).slice(0, 40)}" passa de ${maxTitleChars} caracteres, o limite da API oficial. O envio é recusado.`,
            fixHint: "Encurte o texto da opção.",
          });
        }
        continue;
      }
      if (isMeta && !(facts.canSendOfficialMenu && payload.mode === "preset")) {
        report(node, {
          severity: "error",
          code: "META_BUTTONS_BLOCKED",
          title: "Menu de botões não sai na API oficial",
          message: "Hoje a automação não envia menu de botões em número da API oficial. Este passo falha.",
          fixHint: "Use uma mensagem de texto com as opções, ou o menu de botões do Fluxo de atendimento.",
        });
        continue;
      }
      if (facts.provider === "uazapi" && facts.sendsMenuAsNumberedText) {
        // Aviso, não erro: o fluxo continua rodando, só que o menu chega como texto (spec 0095, RF-7).
        report(node, {
          severity: "warning",
          code: "UNOFFICIAL_MENU_AS_TEXT",
          title: "Sai como lista numerada",
          message: "Este funil usa um número fora da API oficial. Botões e listas só existem na API oficial: aqui o menu chega como texto numerado e o cliente responde com o número.",
          fixHint: "Para enviar botões de verdade, conecte um número com API oficial.",
        });
        continue;
      }
      if (buttons.length > OFFICIAL_API_LIMITS.maxListRows) {
        report(node, {
          severity: "warning",
          code: "TOO_MANY_OPTIONS",
          title: "Opções demais",
          message: `O menu tem ${buttons.length} opções. O WhatsApp mostra no máximo ${OFFICIAL_API_LIMITS.maxListRows}.`,
          fixHint: "Reduza as opções ou divida em dois menus.",
        });
      }
      const titleLimit = buttons.length <= OFFICIAL_API_LIMITS.maxButtons ? OFFICIAL_API_LIMITS.buttonTitleChars : OFFICIAL_API_LIMITS.listRowTitleChars;
      const longTitle = buttons.find((button) => String(button.text ?? "").length > titleLimit);
      if (longTitle) {
        report(node, {
          severity: "warning",
          code: "OPTION_TITLE_TOO_LONG",
          title: "Texto do botão longo demais",
          message: `"${String(longTitle.text).slice(0, 40)}" passa de ${titleLimit} letras e aparece cortado no WhatsApp.`,
          fixHint: "Encurte o texto do botão.",
        });
      }
      continue;
    }

    if (!isMeta || !FREE_FORM_PAYLOADS.has(payloadType) || !sendsToTheLead(config) || hasFallbackTemplate(config)) continue;
    const windowState = arrival.get(node.id);
    if (!windowState) continue;
    if (isWindowCertainlyClosed(windowState.minutes)) {
      report(node, {
        severity: "error",
        code: "META_WINDOW_NEEDS_TEMPLATE",
        title: "Fora do prazo de 24 h",
        message: WINDOW_ERROR_MESSAGE,
        fixHint: "Abra o passo e escolha um template reserva.",
      });
    } else if (windowState.hasLongReplyWait) {
      report(node, {
        severity: "warning",
        code: "META_WINDOW_CLOSED_IF_NO_REPLY",
        title: "Sem resposta, não é entregue",
        message: "Se o cliente não responder antes, esta mensagem cai fora do prazo de 24 h e a API oficial não entrega sem template.",
        fixHint: "Escolha um template reserva neste passo.",
      });
    } else if (windowState.minutes === null && !hasWarnedAboutUncertainWindow) {
      hasWarnedAboutUncertainWindow = true;
      report(node, {
        severity: "warning",
        code: "META_WINDOW_MAY_BE_CLOSED",
        title: "Pode estar fora das 24 h",
        message: "Se o cliente não tiver escrito nas últimas 24 h, a API oficial não entrega esta mensagem.",
        fixHint: "Escolha um template reserva neste passo para garantir a entrega.",
      });
    }
  }
  // Ligações: quadro que o fluxo não alcança nunca roda; gatilho sem saída não faz nada.
  for (const node of nodes) {
    const nodeType = String(node.type ?? "");
    if (!nodeType || NON_STEP_TYPES.has(nodeType)) continue;
    if (TRIGGER_TYPES.has(nodeType)) {
      if (nodes.length > 1 && (outgoing.get(node.id) ?? []).length === 0) {
        report(node, {
          severity: "error",
          code: "TRIGGER_LEADS_NOWHERE",
          title: "Gatilho sem continuação",
          message: "Este gatilho não está ligado a nenhum passo. Quando ele disparar, nada acontece.",
          fixHint: "Arraste a saída do gatilho até o primeiro passo.",
        });
      }
      continue;
    }
    if (!arrival.has(node.id)) {
      report(node, {
        severity: "error",
        code: "NODE_DISCONNECTED",
        title: "Passo desligado do fluxo",
        message: "Nenhum gatilho chega até este passo, então ele nunca roda.",
        fixHint: "Ligue a saída de um passo anterior na entrada deste.",
      });
    }
  }

  return diagnostics;
}

export interface FlowDiagnosticsIndex {
  all: FlowDiagnostic[];
  byNode: Record<string, FlowDiagnostic[]>;
  /** Só ligações de quadros com ERRO. */
  errorEdgeIds: Record<string, true>;
  /**
   * Quadros que vêm DEPOIS de um passo com problema. Nos dois motores, quando um passo falha o que
   * está ligado depois dele não roda: no modo agente o ramo para ali; no modo clássico o fluxo inteiro para.
   */
  blockedNodeIds: Record<string, true>;
}

export const EMPTY_FLOW_DIAGNOSTICS: FlowDiagnosticsIndex = { all: [], byNode: {}, errorEdgeIds: {}, blockedNodeIds: {} };

export function indexFlowDiagnostics(diagnostics: FlowDiagnostic[], edges: FlowEdgeInput[] = []): FlowDiagnosticsIndex {
  if (diagnostics.length === 0) return EMPTY_FLOW_DIAGNOSTICS;
  const byNode: Record<string, FlowDiagnostic[]> = {};
  const errorEdgeIds: Record<string, true> = {};
  for (const diagnostic of diagnostics) {
    byNode[diagnostic.nodeId] = [...(byNode[diagnostic.nodeId] ?? []), diagnostic];
    if (diagnostic.severity === "error") for (const edgeId of diagnostic.edgeIds) errorEdgeIds[edgeId] = true;
  }

  const targetsBySource = new Map<string, string[]>();
  for (const edge of edges) targetsBySource.set(edge.source, [...(targetsBySource.get(edge.source) ?? []), edge.target]);
  const blockedNodeIds: Record<string, true> = {};
  const pending = Object.keys(byNode).flatMap((nodeId) => targetsBySource.get(nodeId) ?? []);
  while (pending.length > 0) {
    const nodeId = pending.pop()!;
    if (blockedNodeIds[nodeId]) continue;
    blockedNodeIds[nodeId] = true;
    pending.push(...(targetsBySource.get(nodeId) ?? []));
  }
  return { all: diagnostics, byNode, errorEdgeIds, blockedNodeIds };
}
