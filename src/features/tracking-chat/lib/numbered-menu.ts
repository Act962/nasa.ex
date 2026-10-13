// Menu em texto numerado para número fora da API oficial (spec 0095). Botão e lista são recursos da
// API oficial; nos demais números o menu sai como "1 – Opção" e a resposta com o número vale como
// clique. Sem `server-only`: as telas usam o mesmo interruptor para avisar e bloquear.

/** Interruptor da spec 0095. Desligado, botões continuam saindo em qualquer número, como sempre. */
export function isButtonsOfficialOnly(): boolean {
  return process.env.NEXT_PUBLIC_BUTTONS_OFFICIAL_ONLY === "true";
}

export const OFFICIAL_ONLY_MESSAGE = "Botões e listas só podem ser enviados em número com API oficial.";
export const NUMBERED_MENU_NOTICE = "Este funil usa um número fora da API oficial: os menus saem como texto numerado, e o cliente responde com o número da opção.";
const REPLY_INSTRUCTION = "Responda com o número da opção.";

// Alias, não interface: vai para `Message.metadata`, e o Prisma só aceita como JSON um tipo com chaves abertas.
export type NumberedOption = {
  id: string;
  title: string;
};

/** O texto que vai ao cliente no lugar dos botões. */
export function formatNumberedMenu(params: { body: string; options: NumberedOption[]; footer?: string | null }): string {
  const lines = params.options.map((option, optionIndex) => `${optionIndex + 1} – ${option.title}`);
  return [params.body.trim(), "", ...lines, "", ...(params.footer?.trim() ? [params.footer.trim()] : []), REPLY_INSTRUCTION].join("\n");
}

/** O que fica gravado na mensagem enviada, para a resposta por número achar a opção. */
export function numberedMenuMetadata(options: NumberedOption[]): { numberedOptions: NumberedOption[] } {
  return { numberedOptions: options.map((option) => ({ id: option.id, title: option.title })) };
}

export function readNumberedOptions(metadata: unknown): NumberedOption[] {
  const stored = (metadata as { numberedOptions?: unknown } | null)?.numberedOptions;
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((option) => {
    const candidate = option as { id?: unknown; title?: unknown };
    return typeof candidate?.id === "string" && typeof candidate?.title === "string" ? [{ id: candidate.id, title: candidate.title }] : [];
  });
}

const NUMBER_REPLY = /^(?:op[cç][aã]o\s+|n[uú]mero\s+)?(\d{1,2})[\s.)!-]*$/i;

function normalizeReply(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s.!?]+$/g, "")
    .trim();
}

/** A opção que o cliente escolheu ao responder com o número ou com o texto exato dela. `null` = não é escolha. */
export function resolveNumberedReply(replyText: string, options: NumberedOption[]): NumberedOption | null {
  const trimmed = replyText.trim();
  if (!trimmed || options.length === 0) return null;
  const chosenNumber = trimmed.match(NUMBER_REPLY)?.[1];
  if (chosenNumber) return options[Number(chosenNumber) - 1] ?? null;
  const normalizedReply = normalizeReply(trimmed);
  return options.find((option) => normalizeReply(option.title) === normalizedReply) ?? null;
}
