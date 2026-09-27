import "server-only";
import { WRITE_VERB, normalizeQuestion } from "@/features/astro/queries/types";
import { parsePickedAnswer } from "@/features/astro/lib/astro-picker";

// Leitura da resposta a uma pergunta do roteiro — compartilhada pelo ciclo
// guiado de um verbo e pelo plano de várias partes.

/**
 * Desistência é a MENSAGEM INTEIRA, nunca um começo de frase.
 *
 * A lista antiga casava por prefixo e incluía "para" e "deixa" — que em
 * português são preposição e verbo comuns. "Para o Banco Teste" e "deixa no
 * Nubank" são respostas legítimas à pergunta da conta, e viravam
 * cancelamento do lançamento inteiro.
 */
export const ABANDON_PHRASES = new Set([
  "cancela", "cancelar", "cancele", "cancela tudo", "cancelar tudo",
  "esquece", "esqueca", "esquece isso", "deixa pra la", "deixa pra depois",
  "para", "parar", "pare", "zerar", "zera", "zerar interacao",
  "limpa", "limpar", "recomecar", "recomeca", "sair", "nao quero",
  "nao quero mais", "desisto", "chega",
]);

/**
 * Isto é resposta à pergunta, ou assunto novo?
 *
 * "Me envie a lista das contas", respondendo a "em qual conta?", virava o
 * NOME de uma conta inexistente — e o Astro respondia "não achei conta com
 * me envie a lista das contas". Resposta é curta, ou casa com uma das opções
 * oferecidas. Pedido novo tem verbo e tamanho.
 */
/**
 * Pergunta de verdade, não qualquer frase com "que" dentro.
 *
 * `ASKS` serve à camada de leitura, onde falso positivo custa uma consulta a
 * mais. Aqui custa o lançamento inteiro do usuário, então a régua é outra: a
 * frase precisa COMEÇAR como pergunta, ou trazer verbo de escrita com corpo.
 */
const NEW_QUESTION =
  /^(quantos|quantas|quais|qual|quem|onde|quando|como|me mostra|me manda|me envia|me envie|mostra|liste|lista as|lista os|lista de)\b/;

export function looksLikeNewRequest(text: string, options?: { label: string }[]): boolean {
  const normalized = normalizeQuestion(text);
  // Casou com uma opção oferecida: é resposta, ponto final.
  if (
    options?.some(
      (option) =>
        normalizeQuestion(option.label) === normalized ||
        normalizeQuestion(option.label).includes(normalized),
    )
  ) {
    return false;
  }
  if (NEW_QUESTION.test(normalized)) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length > 3 && WRITE_VERB.test(normalized);
}

const ORDINALS: Record<string, number> = {
  primeira: 1, primeiro: 1, segunda: 2, segundo: 2, terceira: 3, terceiro: 3,
  quarta: 4, quarto: 4, quinta: 5, quinto: 5, ultima: -1, ultimo: -1,
};

/**
 * Traduz a resposta para uma das opções oferecidas.
 *
 * Gente não responde "Banco Teste" — responde "para o Banco Teste", "no
 * Nubank mesmo", "a primeira". Passar o texto cru adiante fazia a busca
 * procurar uma conta chamada "para o Banco Teste" e não achar nada, e o
 * ciclo morria com a resposta certa na mão.
 */
export function answerToValue(
  text: string,
  options?: { id: string; label: string }[],
): string {
  const trimmed = text.trim();
  // Escolha feita na busca do cartão já traz o id; nada a adivinhar.
  if (parsePickedAnswer(trimmed).id) return trimmed;
  if (!options || options.length === 0) return trimmed;
  const normalized = normalizeQuestion(trimmed);

  const index = Number(normalized);
  if (Number.isInteger(index) && index >= 1 && index <= options.length) {
    return options[index - 1].label;
  }

  const ordinalWord = Object.keys(ORDINALS).find((word) =>
    new RegExp(`\\b${word}\\b`).test(normalized),
  );
  if (ordinalWord) {
    const position = ORDINALS[ordinalWord];
    const chosen = position === -1 ? options[options.length - 1] : options[position - 1];
    if (chosen) return chosen.label;
  }

  // Rótulo citado dentro da frase, ou a frase dentro do rótulo.
  const matched = options.find((option) => {
    const label = normalizeQuestion(option.label);
    return label === normalized || normalized.includes(label) || label.includes(normalized);
  });
  if (matched) return matched.label;

  // Sem correspondência exata, vale a opção com mais palavras em comum.
  // A comparação ignora espaço e pontuação: "Nubank" precisa achar
  // "Nu bank - 526337699-7", e ninguém digita o traço.
  const squash = (value: string) => value.replace(/[^a-z0-9]/g, "");
  const words = normalized.split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
  let best: { label: string; score: number } | null = null;
  for (const option of options) {
    const label = squash(normalizeQuestion(option.label));
    const score = words.filter((word) => label.includes(squash(word))).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { label: option.label, score };
    }
  }
  return best ? best.label : trimmed;
}

/** Mensagem inteira de desistência ("cancela", "esquece")? */
export function isAbandonPhrase(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return ABANDON_PHRASES.has(normalized.replace(/[.!?]+$/, ""));
}

/** Só strings entram no slot; o resto se reconstrói no `buildActionInput`. */
export function toStringFields(fields: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = typeof value === "string" ? value : String(value);
  }
  return out;
}
