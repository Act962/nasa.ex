// Fluxo do FlowAstro no formato da IA (spec 0142, D-1): blocos com apelido, tipo do catálogo e `next` por saída. O
// servidor gera ids, posições e ligações do editor, e devolve avisos em linguagem simples para a IA corrigir.
import { createId } from "@paralleldrive/cuid2";
import { autoLayoutWorkflow } from "@/features/editor/lib/auto-layout";
import { OFFICIAL_MENU_LIMITS } from "@/features/workflows/lib/button-reply-flow";
import { BLOCKS, blockOf, blockOutputs, type BlockKey } from "./block-catalog";
import { blockPreview } from "./block-preview";
import { ANSWER_TYPES, LEAD_FIELD_OPTIONS } from "./nodes";

/** Teto de blocos por fluxo pelo MCP (RNF-3). */
export const MAX_MCP_BLOCKS = 200;
const ALIAS_PATTERN = /^[A-Za-z0-9_-]{1,60}$/;
const MAIN_OUTPUT = "main";
const EDITOR_MAIN_HANDLE = "source-1";
const EDITOR_TARGET_HANDLE = "target-1";

export interface McpBlock {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  next?: Record<string, string>;
}

export interface StoredNode {
  id: string;
  type: string;
  data: unknown;
  position?: { x: number; y: number };
}

export interface StoredConnection {
  fromNodeId: string;
  toNodeId: string;
  fromOutput: string;
}

export interface GraphForSave {
  nodes: { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }[];
  edges: { source: string; target: string; sourceHandle: string; targetHandle: string }[];
}

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : {};
}

// ─── Catálogo para a IA ──────────────────────────────────────

/** O `data` de cada bloco, em palavras (D-2: é o mesmo formato do editor). */
const DATA_GUIDE: Record<BlockKey, string> = {
  start:
    'mode: "WELCOME" (primeira mensagem do contato no número), "KEYWORD" (a mensagem tem uma das keywords), "DEFAULT" (nenhuma outra regra pegou) ou "BROADCAST" (só por disparo). keywords: lista de palavras, só no KEYWORD. matchMode: "CONTAINS" (padrão) ou "EXACT". Um fluxo tem um bloco inicial só.',
  message: `action.payload.type: "TEXT" (message), "BUTTONS" (message + buttons [{id, text}], menuFormat "BUTTON" até ${OFFICIAL_MENU_LIMITS.maxButtons} botões de ${OFFICIAL_MENU_LIMITS.buttonTitleChars} letras, ou "LIST" até ${OFFICIAL_MENU_LIMITS.maxListRows} itens de ${OFFICIAL_MENU_LIMITS.listRowTitleChars} letras com listButton), "IMAGE" (imageUrl, caption), "DOCUMENT" (documentUrl, fileName, caption) ou "AUDIO" (audioUrl, fileName; OGG sai como mensagem de voz). Mídia: link https público. replyTimeoutMinutes (opcional, só com botões) cria a saída no_reply. O id de cada botão vira a saída btn:<id>; use ids curtos sem espaço.`,
  question: `question: o texto da pergunta. answerType: ${ANSWER_TYPES.join(", ")} (FILE = foto ou arquivo). variableName: nome da variável do fluxo que guarda a resposta ({{vars.nome}}). saveToField (opcional): ${LEAD_FIELD_OPTIONS.map((option) => option.key).join(", ")}. maxAttempts 1 a 5. invalidMessage: o que mandar quando a resposta não vale. replyTimeoutMinutes (opcional) cria a saída no_reply.`,
  condition:
    'match: "ALL" ou "ANY". rules: [{id, field, operator, value}]. field: "tag" (is/is_not, value = id da etiqueta), "weekday" (is/is_not, value = lista de dias "0" a "6", 0 = domingo), "time" (between/not_between, value "08:00-18:00"), "responsible" (assigned/not_assigned/is/is_not), "temperature" (is/is_not: COLD, WARM, HOT, VERY_HOT), "column" (is/is_not, value = id da coluna), "lead.<campo>" ou "var.<variável>" (equals, not_equals, contains, not_contains, is_set, is_empty).',
  randomizer: 'paths: [{id, label, percent}], até 5 caminhos; cada um vira a saída path:<id>.',
  delay: 'action: {type: "minutes" | "hours" | "days", <type>: número}. Ex.: {type: "hours", hours: 2}. Mensagens do cliente durante o atraso não respondem nada.',
  callFlow: "workflowId: id de outro fluxo do FlowAstro da mesma empresa (flowastro_list_flows).",
  aiAgent:
    "instructions: o que a IA faz nesta etapa. goal: quando a etapa está cumprida (sai por objective_done). maxReplies: limite de mensagens da IA (padrão 20). intents: [{id, label, description}] até 5, cada uma vira a saída intent:<id>. fields: [{variableName, leadField?, description}] o que a IA deve coletar. Sem `assistant`, usa a IA configurada no funil do número; o assistente próprio do bloco é configurado no editor.",
  distribute: "Sem campos: escolhe o atendente pelo rodízio do número. Saídas main (atendente escolhido) e no_attendant.",
  tag: 'action: {type: "ADD" | "REMOVE", tagsIds: [ids das etiquetas]} (flowastro_list_numbers traz as etiquetas).',
  moveColumn: "columns: {<id do número>: <id da coluna>} (flowastro_list_numbers traz as colunas de cada número). Move e segue.",
  finish: "columns (opcional): {<id do número>: <id da coluna>}. Encerra o fluxo do lead; não tem saída.",
  promoEnroll: 'nameSource: "ASK" (pergunta o nome completo), "CONTACT" (nome do contato) ou "VARIABLE" (nameVariable). Precisa de campanha ativa no STAR FRIENDS.',
  promoReceipt:
    "photoVariable: variável de uma Pergunta com answerType FILE (vazio = última foto). sendDefaultReply: true responde com a mensagem da promoção. Grava {{vars.numeros_da_sorte}}, qtd_numeros, valor_cupom, saldo_proximo_numero.",
  promoLookup: "askPhone: true pede o celular para conferir o dono do cadastro. Grava qtd_cupons, total_compras, qtd_numeros, saldo_proximo_numero, numeros_da_sorte, stars.",
};

const OUTPUT_GUIDE: Record<BlockKey, string> = {
  start: "main",
  message: "Sem botões: main. Com botões: btn:<id do botão> para cada um, no_click (o cliente digitou em vez de tocar) e no_reply com prazo.",
  question: "answered, invalid (esgotou as tentativas) e no_reply com prazo.",
  condition: "true (as regras batem) e false.",
  randomizer: "path:<id> de cada caminho.",
  delay: "main",
  callFlow: "Nenhuma: o lead segue no outro fluxo.",
  aiAgent: "intent:<id> de cada intenção, objective_done, wants_human, max_replies, error e no_reply com prazo.",
  distribute: "main e no_attendant.",
  tag: "main",
  moveColumn: "main",
  finish: "Nenhuma.",
  promoEnroll: "enrolled, already_enrolled, refused, closed, other e no_reply com prazo.",
  promoReceipt: "accepted, duplicate, not_valid, unreadable, in_review, daily_limit, not_enrolled, closed, try_later.",
  promoLookup: "done, not_enrolled; com askPhone também phone_mismatch, other e no_reply com prazo.",
};

export function buildBlockCatalog() {
  return {
    format:
      'Um fluxo é uma lista de blocos {id, type, data, next}. id: apelido seu, único (letras, números, _ e -). type: a chave abaixo. next: {"<saída>": "<id do bloco seguinte>"}, uma ligação por saída. O servidor posiciona os blocos e devolve warnings para você corrigir.',
    variables:
      "Textos aceitam {{nome}}, {{primeiro_nome}}, {{phone}}, {{email}}, {{status}} (coluna), {{track}} (funil), {{responsavel}}, {{data}} e as variáveis do fluxo {{vars.<nome>}} (gravadas por Pergunta, Agente de IA, Distribuição e blocos da promoção).",
    entryRules:
      "Num mesmo número ligado, só um fluxo de Boas-vindas, só um de Resposta padrão e nenhuma palavra-chave repetida. Quem já está num fluxo fica nele até terminar.",
    blocks: BLOCKS.map((block) => ({
      type: block.key,
      label: block.label,
      description: block.description,
      category: block.category,
      data: DATA_GUIDE[block.key],
      exampleData: block.defaultData,
      outputs: OUTPUT_GUIDE[block.key],
    })),
  };
}

// ─── Do banco para a IA ──────────────────────────────────────

/**
 * Apelido de cada bloco salvo: o `mcpId` que a IA deu, ou o id real. Bloco duplicado no editor leva o mesmo `mcpId`;
 * o segundo em diante usa o id real, para os apelidos nunca se repetirem.
 */
function aliasesOf(nodes: StoredNode[]): Map<string, string> {
  const aliases = new Map<string, string>();
  const used = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    const mcpId = asFields(node.data).mcpId;
    const isFreeAlias = typeof mcpId === "string" && ALIAS_PATTERN.test(mcpId) && !used.has(mcpId);
    aliases.set(node.id, isFreeAlias ? mcpId : node.id);
    if (isFreeAlias) used.add(mcpId);
  }
  return aliases;
}

function outputForAi(handle: string): string {
  return handle === EDITOR_MAIN_HANDLE ? MAIN_OUTPUT : handle;
}

export function toMcpBlocks(nodes: StoredNode[], connections: StoredConnection[]): McpBlock[] {
  const aliasById = aliasesOf(nodes);
  return nodes.map((node) => {
    const { mcpId: _mcpId, ...data } = asFields(node.data);
    const next: Record<string, string> = {};
    for (const connection of connections) {
      if (connection.fromNodeId !== node.id) continue;
      const target = aliasById.get(connection.toNodeId);
      if (target) next[outputForAi(connection.fromOutput)] = target;
    }
    return { id: aliasById.get(node.id) ?? node.id, type: blockOf(node.type, node.data)?.key ?? node.type, data, next };
  });
}

// ─── Da IA para o banco ──────────────────────────────────────

/** Mensagem com botões vira o menu que espera o clique, igual ao editor; sem botões, texto comum. */
function normalizeMessageData(data: Fields): Fields {
  const action = asFields(data.action);
  const payload = asFields(action.payload);
  const buttons = Array.isArray(payload.buttons) ? (payload.buttons as unknown[]).map((button) => asFields(button)) : [];
  const isMenu = payload.type === "BUTTONS" || (payload.type !== "IMAGE" && payload.type !== "DOCUMENT" && payload.type !== "AUDIO" && buttons.length > 0);
  if (!isMenu) {
    const type = typeof payload.type === "string" ? payload.type : "TEXT";
    const message = typeof payload.message === "string" ? payload.message : "";
    return { ...data, action: { ...action, payload: { ...payload, type, ...(type === "TEXT" ? { message, bodyText: message, buttons: [] } : {}) } } };
  }
  const message = typeof payload.message === "string" ? payload.message : typeof payload.bodyText === "string" ? payload.bodyText : "";
  const menuFormat = payload.menuFormat === "LIST" ? "LIST" : "BUTTON";
  const normalizedButtons = buttons.map((button, index) => ({
    id: typeof button.id === "string" && button.id.trim() ? button.id.trim() : `op${index + 1}`,
    text: typeof button.text === "string" ? button.text : "",
  }));
  return {
    ...data,
    action: {
      ...action,
      payload: {
        ...payload,
        type: "BUTTONS",
        mode: "inline",
        waitForReply: true,
        message,
        bodyText: message,
        buttons: normalizedButtons,
        menuFormat,
        ...(menuFormat === "LIST" ? { listButton: typeof payload.listButton === "string" && payload.listButton ? payload.listButton : "Ver opções" } : {}),
      },
    },
  };
}

function dataForBlock(key: BlockKey, rawData: Fields | undefined, defaultData: Fields): Fields {
  const data = { ...defaultData, ...(rawData ?? {}) };
  if (key === "message") return normalizeMessageData(data);
  if (key === "finish") return { ...data, endFlow: true };
  if (key === "moveColumn") return { ...data, endFlow: false };
  return data;
}

/** Tamanho aproximado do cartão, para o organizador não sobrepor blocos. */
function cardSizeOf(outputCount: number): { width: number; height: number } {
  return { width: 260, height: 130 + outputCount * 28 };
}

export type FromMcpResult = { ok: true; graph: GraphForSave; warnings: string[] } | { ok: false; error: string };

/**
 * Converte os blocos da IA no desenho do editor. Mantém o id real de quem já existia (pelo apelido ou pelo próprio id),
 * para leads que esperam num bloco não saírem do fluxo só porque a IA reenviou o desenho.
 */
export function fromMcpBlocks(blocks: McpBlock[], previousNodes: StoredNode[]): FromMcpResult {
  if (blocks.length > MAX_MCP_BLOCKS) return { ok: false, error: `Até ${MAX_MCP_BLOCKS} blocos por fluxo.` };
  const seen = new Set<string>();
  for (const block of blocks) {
    if (!ALIAS_PATTERN.test(block.id)) return { ok: false, error: `Apelido inválido "${block.id}": use letras, números, _ ou -.` };
    if (seen.has(block.id)) return { ok: false, error: `O apelido "${block.id}" aparece em mais de um bloco.` };
    seen.add(block.id);
    if (!BLOCKS.some((definition) => definition.key === block.type)) return { ok: false, error: `Tipo de bloco desconhecido "${block.type}" em "${block.id}". Veja flowastro_get_block_catalog.` };
  }
  const startBlocks = blocks.filter((block) => block.type === "start");
  if (startBlocks.length > 1) return { ok: false, error: "O fluxo tem um bloco inicial (start) só." };

  const warnings: string[] = [];
  const workingBlocks = [...blocks];
  if (startBlocks.length === 0) {
    workingBlocks.unshift({ id: "inicio", type: "start", data: {}, next: {} });
    warnings.push('O fluxo não tinha bloco inicial: criei "inicio" (Resposta padrão), sem ligação. Ligue a saída main dele ao primeiro bloco.');
  }

  // O id real só passa para o bloco novo se ele continua do mesmo tipo: quem espera numa Pergunta não pode acordar
  // num menu só porque a IA reaproveitou o apelido.
  const previousByAlias = new Map<string, StoredNode>();
  const previousAliases = aliasesOf(previousNodes);
  for (const node of previousNodes) {
    previousByAlias.set(node.id, node);
    previousByAlias.set(previousAliases.get(node.id) ?? node.id, node);
  }
  const nodeIdByAlias = new Map(
    workingBlocks.map((block) => {
      const previous = previousByAlias.get(block.id);
      const nodeType = BLOCKS.find((definition) => definition.key === block.type)?.nodeType;
      return [block.id, previous && previous.type === nodeType ? previous.id : createId()];
    }),
  );

  const nodes = workingBlocks.map((block) => {
    const definition = BLOCKS.find((item) => item.key === block.type)!;
    const nodeId = nodeIdByAlias.get(block.id)!;
    const data = dataForBlock(definition.key, block.data, definition.defaultData);
    return { id: nodeId, type: definition.nodeType, position: { x: 0, y: 0 }, data: nodeId === block.id ? data : { ...data, mcpId: block.id } };
  });

  const edges: GraphForSave["edges"] = [];
  const adjacency = new Map<string, string[]>();
  workingBlocks.forEach((block, index) => {
    const node = nodes[index];
    const validOutputs = new Map(blockOutputs(node.type, node.data).map((output) => [outputForAi(output.handleId), output.handleId]));
    for (const [output, targetAlias] of Object.entries(block.next ?? {})) {
      const handle = validOutputs.get(output);
      const targetId = nodeIdByAlias.get(targetAlias);
      if (!handle) {
        warnings.push(`"${block.id}" não tem a saída "${output}" (tem: ${[...validOutputs.keys()].join(", ") || "nenhuma"}). Ligação ignorada.`);
        continue;
      }
      if (!targetId) {
        warnings.push(`"${block.id}" liga "${output}" a "${targetAlias}", que não existe. Ligação ignorada.`);
        continue;
      }
      edges.push({ source: node.id, target: targetId, sourceHandle: handle, targetHandle: EDITOR_TARGET_HANDLE });
      adjacency.set(node.id, [...(adjacency.get(node.id) ?? []), targetId]);
    }
  });

  nodes.forEach((node, index) => {
    for (const line of blockPreview(node.type, node.data)) {
      if (line.isEmpty) warnings.push(`"${workingBlocks[index].id}": ${line.text}.`);
    }
  });

  const startNode = nodes.find((node) => node.type === "ATTENDANCE_START");
  const reached = new Set<string>(startNode ? [startNode.id] : []);
  const queue = startNode ? [startNode.id] : [];
  while (queue.length > 0) {
    for (const nextId of adjacency.get(queue.shift()!) ?? []) {
      if (!reached.has(nextId)) {
        reached.add(nextId);
        queue.push(nextId);
      }
    }
  }
  const unreachable = workingBlocks.filter((_, index) => !reached.has(nodes[index].id)).map((block) => block.id);
  if (unreachable.length > 0) warnings.push(`Nenhum caminho do bloco inicial chega a: ${unreachable.join(", ")}.`);

  // Só textos mudaram: os blocos ficam onde a pessoa deixou. Bloco novo reorganiza tudo, como o botão "Organizar".
  const previousPositionById = new Map(previousNodes.flatMap((node) => (node.position ? [[node.id, node.position] as const] : [])));
  if (nodes.every((node) => previousPositionById.has(node.id))) {
    return { ok: true, graph: { nodes: nodes.map((node) => ({ ...node, position: previousPositionById.get(node.id)! })), edges }, warnings };
  }
  const { nodes: laidOut } = autoLayoutWorkflow(
    nodes.map((node) => ({ id: node.id, position: node.position, data: {}, ...cardSizeOf(blockOutputs(node.type, node.data).length) })),
    edges.map((edge, index) => ({ id: `edge-${index}`, source: edge.source, target: edge.target })),
    { direction: "LR", nodeSep: 50, rankSep: 110 },
  );
  const positionById = new Map(laidOut.map((node) => [node.id, node.position]));
  return {
    ok: true,
    graph: { nodes: nodes.map((node) => ({ ...node, position: positionById.get(node.id) ?? node.position })), edges },
    warnings,
  };
}

/** Avisos de um fluxo já salvo (para a leitura): os mesmos da gravação. */
export function warningsOfStoredFlow(nodes: StoredNode[], connections: StoredConnection[]): string[] {
  const result = fromMcpBlocks(toMcpBlocks(nodes, connections), nodes);
  return result.ok ? result.warnings : [result.error];
}
