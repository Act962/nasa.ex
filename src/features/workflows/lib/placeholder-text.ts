// Texto de exemplo do modelo de atendimento (spec 0097): enquanto existir num fluxo ou menu, ele não
// liga e nada é enviado ao cliente. A marca é o começo do colchete, para "[Promoção]" não travar.

export const PLACEHOLDER_MARK = "[Escreva aqui";

export function hasPlaceholderText(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.toLowerCase().includes(PLACEHOLDER_MARK.toLowerCase());
}

export const PLACEHOLDER_PROBLEM = {
  title: "Troque o texto de exemplo",
  message: "Ainda há um trecho entre colchetes que começa com \"Escreva aqui\". Escreva o texto da sua empresa para poder ligar.",
} as const;
