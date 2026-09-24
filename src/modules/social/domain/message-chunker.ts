/**
 * Limites de texto da mensagem privada do Instagram.
 *
 * São **caracteres**, não bytes: acento e espaço contam um. A implementação
 * anterior media bytes UTF-8 com margem de 950, o que em português tirava
 * dezenas de caracteres legítimos do usuário sem explicar por quê.
 *
 * Com botão a mensagem vira template de botão, e o limite cai.
 */
export const MAX_MESSAGE_CHARS = 1000;
export const MAX_BUTTON_TEMPLATE_CHARS = 640;

/**
 * Conta por code point: emoji fora do plano básico ocupa duas unidades UTF-16,
 * e `"🙂".length === 2` faria a conta divergir do que a pessoa digitou.
 */
export function countChars(value: string): number {
  return Array.from(value).length;
}

export function limitForMessage(hasButtons: boolean): number {
  return hasButtons ? MAX_BUTTON_TEMPLATE_CHARS : MAX_MESSAGE_CHARS;
}

/** Quebra o texto em blocos que cabem no limite, preferindo cortar em espaço. */
export function splitTextByChars(
  text: string,
  maxChars: number = MAX_MESSAGE_CHARS,
): string[] {
  if (!text) return [];
  if (countChars(text) <= maxChars) return [text];

  const chunks: string[] = [];
  let current = "";

  for (const word of text.split(/(\s+)/)) {
    if (countChars(current + word) <= maxChars) {
      current += word;
      continue;
    }

    if (current.trim()) chunks.push(current.trim());
    current = "";

    // Palavra única maior que o limite: parte por caractere.
    if (countChars(word) > maxChars) {
      let piece = "";
      for (const char of word) {
        if (countChars(piece + char) > maxChars) {
          chunks.push(piece);
          piece = "";
        }
        piece += char;
      }
      current = piece;
    } else {
      current = word.trimStart();
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function truncateToChars(text: string, maxChars: number): string {
  if (countChars(text) <= maxChars) return text;
  return Array.from(text).slice(0, maxChars).join("");
}

/**
 * Planeja os blocos de uma mensagem.
 *
 * Os botões viajam só no **último** bloco, então apenas ele precisa respeitar
 * o limite menor do template. Aplicar 640 em todos desperdiçaria mais de um
 * terço da mensagem à toa.
 */
export function planMessageChunks(
  text: string,
  hasButtons: boolean,
): string[] {
  const chunks = splitTextByChars(text, MAX_MESSAGE_CHARS);
  if (!hasButtons || chunks.length === 0) return chunks;

  const last = chunks[chunks.length - 1];
  if (countChars(last) <= MAX_BUTTON_TEMPLATE_CHARS) return chunks;

  return [
    ...chunks.slice(0, -1),
    ...splitTextByChars(last, MAX_BUTTON_TEMPLATE_CHARS),
  ];
}
