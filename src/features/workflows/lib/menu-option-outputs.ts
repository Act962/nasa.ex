import { buttonOutputId, isMetaInteractiveOn } from "./button-reply-flow";

// Uma saída por opção no menu salvo enviado por um fluxo (spec 0098). Sem `server-only`: o editor
// desenha as saídas com as mesmas regras que o servidor usa para achar o que roda no toque.

export const MENU_OPTION_TRIGGER = "MENU_OPTION_CLICK";
/** Toque duplo na mesma opção, pelo mesmo cliente, roda os passos uma vez só. */
export const MENU_OPTION_REPEAT_WINDOW_MS = 60_000;

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" ? (value as Fields) : {};
}

/** Id do menu salvo que o quadro Enviar Mensagem envia, ou `null` se ele não envia um. */
export function savedMenuIdOf(nodeData: unknown): string | null {
  const fields = asFields(nodeData);
  const action = asFields(fields.action);
  const payload = asFields(Object.keys(action).length > 0 ? action.payload : fields.payload);
  return payload.type === "BUTTONS" && payload.mode === "preset" && typeof payload.presetId === "string" ? payload.presetId : null;
}

export interface MenuOptionOutput {
  /** Nome da saída no fluxo: é o que fica gravado na ligação. */
  id: string;
  optionId: string;
  label: string;
}

/**
 * Uma posição por opção do menu, na ordem em que o cliente vê: o nome da saída, ou `null` quando a
 * opção não tem saída. Só as opções respondidas pelo código (têm resposta guardada) ganham saída: é no
 * toque delas que os passos rodam. Linhas de ação ("Agendar", "Falar com atendente") e opções que
 * aplicam tag seguem o caminho de sempre. `null` no lugar da lista = recurso desligado ou quadro sem menu salvo.
 */
export function menuOptionOutputIdsByRow(nodeData: unknown, savedMenus: { id: string; buttons?: unknown }[]): (string | null)[] | null {
  if (!isMetaInteractiveOn()) return null;
  const savedMenuId = savedMenuIdOf(nodeData);
  const savedMenu = savedMenuId ? savedMenus.find((menu) => menu.id === savedMenuId) : undefined;
  const buttons = Array.isArray(savedMenu?.buttons) ? (savedMenu.buttons as Fields[]) : [];
  const outputIds = buttons.map((button) => (typeof button.id === "string" && button.id && typeof button.answer === "string" ? buttonOutputId(button.id) : null));
  return outputIds.some(Boolean) ? outputIds : null;
}

/** Como `menuOptionOutputIdsByRow`, com a resposta guardada de cada pergunta, para o editor mostrar ao lado. */
export function menuOptionAnswersByRow(nodeData: unknown, savedMenus: { id: string; buttons?: unknown }[]): ({ id: string; answer: string } | null)[] | null {
  const outputIds = menuOptionOutputIdsByRow(nodeData, savedMenus);
  if (!outputIds) return null;
  const savedMenu = savedMenus.find((menu) => menu.id === savedMenuIdOf(nodeData));
  const buttons = Array.isArray(savedMenu?.buttons) ? (savedMenu.buttons as Fields[]) : [];
  return outputIds.map((outputId, buttonIndex) => (outputId ? { id: outputId, answer: String(buttons[buttonIndex]?.answer ?? "") } : null));
}

/** As saídas do quadro, com o título de cada opção. */
export function menuOptionOutputs(nodeData: unknown, savedMenus: { id: string; buttons?: unknown }[]): MenuOptionOutput[] | null {
  const outputIds = menuOptionOutputIdsByRow(nodeData, savedMenus);
  if (!outputIds) return null;
  const savedMenu = savedMenus.find((menu) => menu.id === savedMenuIdOf(nodeData));
  const buttons = Array.isArray(savedMenu?.buttons) ? (savedMenu.buttons as Fields[]) : [];
  return buttons.flatMap((button, buttonIndex) =>
    outputIds[buttonIndex] ? [{ id: outputIds[buttonIndex], optionId: String(button.id), label: String(button.text ?? button.id) }] : [],
  );
}

export interface MenuOptionBranch {
  workflowId: string;
  nodeId: string;
  output: string;
}

/**
 * O que roda quando o cliente toca numa opção: os quadros que enviam aquele menu e têm algo ligado
 * à saída da opção. `flows` já vem filtrado pelo servidor (fluxos ligados do funil da conversa).
 */
export function findMenuOptionBranches(params: {
  flows: { id: string; nodes: { id: string; type: string; data: unknown }[]; connections: { fromNodeId: string; fromOutput: string | null }[] }[];
  menuId: string;
  optionId: string;
}): MenuOptionBranch[] {
  const output = buttonOutputId(params.optionId);
  return params.flows.flatMap((flow) =>
    flow.nodes
      .filter((node) => node.type === "SEND_MESSAGE" && savedMenuIdOf(node.data) === params.menuId)
      .filter((node) => flow.connections.some((connection) => connection.fromNodeId === node.id && connection.fromOutput === output))
      .map((node) => ({ workflowId: flow.id, nodeId: node.id, output })),
  );
}
