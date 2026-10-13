// Menu de botões que espera o clique e segue um caminho por resposta (spec 0090, seção F).
// Sem `server-only`: o editor usa as mesmas regras para desenhar as saídas do quadro.

/** Interruptor da fase: desligado, nada aqui tem efeito e o menu continua com uma saída só. */
export function isMetaInteractiveOn(): boolean {
  return process.env.NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE === "true";
}

export const BUTTON_OUTPUT_PREFIX = "btn:";
/** Saída de quando o cliente não clicou em nenhuma opção: não respondeu no prazo ou escreveu outra coisa. */
export const NO_CLICK_OUTPUT = "no_click";
export const RESUME_BY_BUTTON_REPLY = "buttonReply";
export const DEFAULT_REPLY_TIMEOUT_MINUTES = 1440;

export const OFFICIAL_MENU_LIMITS = { maxButtons: 3, maxListRows: 10, buttonTitleChars: 20, listRowTitleChars: 24 } as const;

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" ? (value as Fields) : {};
}

/** O `payload` do quadro Enviar Mensagem, nos dois formatos de `data`. */
function menuPayload(data: unknown): Fields {
  const fields = asFields(data);
  const action = asFields(fields.action);
  return asFields(Object.keys(action).length > 0 ? action.payload : fields.payload);
}

export function buttonOutputId(buttonId: string): string {
  return `${BUTTON_OUTPUT_PREFIX}${buttonId}`;
}

/**
 * Saídas do quadro quando ele espera o clique: uma por botão escrito no próprio quadro, mais "sem clique".
 * `null` = quadro comum, com a saída única de sempre. Menu salvo (preset) fica de fora nesta fase:
 * os botões dele não estão no quadro, então o desenho não teria como mostrar as saídas.
 */
export function buttonReplyOutputs(data: unknown): { id: string; label: string }[] | null {
  if (!isMetaInteractiveOn()) return null;
  const payload = menuPayload(data);
  if (payload.type !== "BUTTONS" || payload.waitForReply !== true || payload.mode === "preset") return null;
  const buttons = Array.isArray(payload.buttons) ? (payload.buttons as Fields[]) : [];
  const outputs = buttons
    .filter((button) => typeof button.id === "string" && button.id)
    .map((button) => ({ id: buttonOutputId(String(button.id)), label: String(button.text ?? button.id) }));
  if (outputs.length === 0) return null;
  return [...outputs, { id: NO_CLICK_OUTPUT, label: "Sem clique" }];
}

/**
 * Qual saída seguir ao retomar o fluxo. O id do clique é entrada de fora: só vale se for de um botão
 * que este quadro enviou; qualquer outra coisa (prazo vencido, texto livre, id estranho) é "sem clique".
 */
export function chooseButtonReplyOutput(params: { sentButtonIds: string[]; hasTimedOut: boolean; clickedButtonId: unknown }): string {
  if (params.hasTimedOut) return NO_CLICK_OUTPUT;
  const clickedButtonId = typeof params.clickedButtonId === "string" ? params.clickedButtonId : "";
  return params.sentButtonIds.includes(clickedButtonId) ? buttonOutputId(clickedButtonId) : NO_CLICK_OUTPUT;
}
