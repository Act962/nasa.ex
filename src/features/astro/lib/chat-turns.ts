import type { UIMessage } from "ai";

// Leitura dos turnos da conversa que o roteamento do chat usa. Mora aqui para a
// rota e a bateria de testes (`scripts/astro-qa`) decidirem com o mesmo código.

/** Falas anteriores, para o classificador resolver "ele", "a última", etc. */
export function extractConversationHistory(messages: UIMessage[]): string[] {
  return messages
    .slice(0, -1)
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => {
      if (!Array.isArray(message.parts)) return "";
      const text = message.parts
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join(" ")
        .trim();
      return text ? `${message.role === "user" ? "Usuário" : "Astro"}: ${text}` : "";
    })
    .filter(Boolean);
}

/**
 * O turno anterior do Astro deixou uma pergunta no ar?
 *
 * "Financeiro", respondendo a "qual tracking?", casou com a consulta do
 * financeiro e devolveu contas a pagar. Resposta curta a uma pergunta
 * pendente não é pedido novo — e enquanto houver pergunta no ar, a camada
 * de consulta fica de fora.
 */
const PENDING_QUESTION =
  /me diga:|para eu continuar|qual deles\?|escolha |ou workspace\?|me diga o |qual o nome|em qual /i;

export function lastAssistantAsked(messages: UIMessage[]): boolean {
  const lastAssistant = [...messages]
    .slice(0, -1)
    .reverse()
    .find((message) => message.role === "assistant");
  if (!lastAssistant || !Array.isArray(lastAssistant.parts)) return false;
  const text = lastAssistant.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ");
  return PENDING_QUESTION.test(text);
}

export function extractLastUserText(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  if (!lastUser || !Array.isArray(lastUser.parts)) return "";
  return lastUser.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}
